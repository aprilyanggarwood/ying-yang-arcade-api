// cs5610_project3_ying-yang-arcade-api — Battleship backend
// Author: April Yang
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { HTTPException } from 'hono/http-exception';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { db } from './db.js';
import { createUser, findUserByUsername, findUserById } from './models/users.js';
import { verifyPassword } from './auth.js';
import { createSession, findSession, deleteSession } from './models/sessions.js';
import { createGame, listGames, findGame, joinGame, applyShot, gameForViewer } from './models/games.js';



const app = new Hono();
const COOKIE = 'sessionId';

// set the session cookie (omit `secure` so it works over http for local/Bruno testing)
function setSessionCookie(c, sessionId) {
  setCookie(c, COOKIE, sessionId, {
    path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7,
  });
}

// read the session cookie -> session -> user; returns the user or null
async function getCurrentUser(c) {
  const sessionId = getCookie(c, COOKIE);
  const session = await findSession(sessionId);
  if (!session) return null;
  return await findUserById(session.userId);
}


// REGISTER
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  if (!body.username || !body.password) {
    throw new HTTPException(400, { message: 'username and password are required' });
  }
  // no duplicate usernames
  const existing = await findUserByUsername(body.username);
  if (existing) {
    throw new HTTPException(409, { message: 'username already taken' });
  }

  const user = await createUser(body.username, body.password);  // hashes inside
  const sessionId = await createSession(user._id);
  setSessionCookie(c, sessionId);
  return c.json(user, 201);   // user has no passwordHash
});

// LOGIN
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  if (!body.username || !body.password) {
    throw new HTTPException(400, { message: 'username and password are required' });
  }
  const user = await findUserByUsername(body.username);

  // fail the same way whether the user is missing OR the password is wrong
  const ok = user && await verifyPassword(body.password, user.passwordHash);
  if (!ok) {
    throw new HTTPException(401, { message: 'invalid username or password' });
  }

  const sessionId = await createSession(user._id);
  setSessionCookie(c, sessionId);
  return c.json({ _id: user._id, username: user.username });  // never return the hash
});

// LOGOUT
app.post('/api/auth/logout', async (c) => {
  const sessionId = getCookie(c, COOKIE);
  if (sessionId) {
    await deleteSession(sessionId);   // kill it server-side (real revocation)
  }
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

// ME — who am I?
app.get('/api/auth/me', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    throw new HTTPException(401, { message: 'not logged in' });
  }
  return c.json(user);
});

// central error handler (keep this near the bottom)
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: 'Internal error' }, 500);
});


// CREATE a game — the logged-in user becomes player 1
app.post('/api/games', async (c) => {
  const user = await getCurrentUser(c);   // from auth step
  if (!user) {
    throw new HTTPException(401, { message: 'not logged in' });
  }

  const game = await createGame(user._id);   // player 1 is the logged-in user
  return c.json(game, 201);
});


// LIST games (lobby + your games)
app.get('/api/games', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    throw new HTTPException(401, { message: 'not logged in' });
  }
  const all = await listGames(user._id);
  return c.json(all);
});


// JOIN an open game as player 2
app.post('/api/games/:id/join', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    throw new HTTPException(401, { message: 'not logged in' });
  }

  const game = await findGame(c.req.param('id'));
  if (!game) {
    throw new HTTPException(404, { message: 'game not found' });
  }

  // can't join a game that already has two players / isn't waiting
  if (game.status !== 'waiting') {
    throw new HTTPException(409, { message: 'game is not open to join' });
  }
  // can't join your own game
  if (game.player1.toString() === user._id.toString()) {
    throw new HTTPException(409, { message: 'cannot join your own game' });
  }

  const updated = await joinGame(game._id, user._id);
//   return c.json(updated);
     return c.json(gameForViewer(updated, user._id));     // ← hide opponent's ships
});


// FIRE a shot
app.post('/api/games/:id/shots', async (c) => {
  // 1. logged in?
  const user = await getCurrentUser(c);
  if (!user) {
    throw new HTTPException(401, { message: 'not logged in' });
  }

  // 2. game exists?
  const game = await findGame(c.req.param('id'));
  if (!game) {
    throw new HTTPException(404, { message: 'game not found' });
  }

  // 3. are you a player in this game?
  const isP1 = String(game.player1) === String(user._id);
  const isP2 = String(game.player2) === String(user._id);
  if (!isP1 && !isP2) {
    throw new HTTPException(403, { message: 'you are not in this game' });
  }

  // 4. is the game active? (not waiting, not complete)
  if (game.status !== 'active') {
    throw new HTTPException(409, { message: 'game is not active' });
  }

  // 5. is it your turn? (the heart of server-authoritative play)
  if (String(game.turn) !== String(user._id)) {
    throw new HTTPException(409, { message: 'not your turn' });
  }

  // 6. read and validate the shot coordinates from the body
  const body = await c.req.json();
  if (typeof body.row !== 'number' || typeof body.col !== 'number') {
    throw new HTTPException(400, { message: 'row and col must be numbers' });
  }

  // 7. apply the shot via the model (which uses arcade-core)
  const result = await applyShot(game, user._id, body.row, body.col);

  // 8. applyShot returns { error } for an illegal shot
  if (result.error) {
    throw new HTTPException(400, { message: result.error });
  }

  return c.json(gameForViewer(result.game, user._id));
});


// GET one game (board hidden appropriately for the viewer)
app.get('/api/games/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    throw new HTTPException(401, { message: 'not logged in' });
  }

  const game = await findGame(c.req.param('id'));
  if (!game) {
    throw new HTTPException(404, { message: 'game not found' });
  }

  // only the two players may view it
  const isP1 = String(game.player1) === String(user._id);
  const isP2 = String(game.player2) === String(user._id);
  if (!isP1 && !isP2) {
    throw new HTTPException(403, { message: 'you are not in this game' });
  }

  return c.json(gameForViewer(game, user._id));
});



app.get('/', (c) => c.text('Arcade API is running'));

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 });
console.log('http://localhost:3000');
