# Ying-Yang Arcade API

The backend API for April's Game Parlor Battleship, built with
[Hono](https://hono.dev/) and MongoDB. It owns all authentication and
game state: the server decides ship placement, whose turn it is, and the
outcome of every shot, so the client can never tamper with the game.

**Author:** April Yang
**Live API:** https://ying-yang-arcade-api.onrender.com
**Frontend app:** https://ying-yang-arcade.onrender.com
**Game logic package:** [@april-cs-npm/arcade-core](https://www.npmjs.com/package/@april-cs-npm/arcade-core)

## Overview

- **Auth** uses sessions: passwords are hashed with bcrypt, and a session id
  stored in an httpOnly cookie identifies the logged-in user. The server looks
  up the session on each request.
- **Game rules** come from the published `@april-cs-npm/arcade-core` package
  (`createRandomBoard`, `isValidShot`, `updateBoard`, `isGameComplete`), which
  is pure JavaScript with no database or framework code.
- **Server-authoritative state:** the full game (both boards, whose turn, the
  winner) lives in MongoDB. When a game is sent to a player, the opponent's
  un-hit ships are removed from the response, so ship positions never reach the
  browser.

## Requirements

- Node.js 22.17+
- A MongoDB connection string (e.g. MongoDB Atlas)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root:
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/arcade

   `.env` is gitignored and must never be committed.

3. Run locally:
    ```bash
    npm run dev
    ```
    The API starts on http://localhost:3000.

## Authentication

Login state is a session. Register and login set an httpOnly `sessionId`
cookie; logout deletes the session server-side and clears the cookie. All
`/api/games` routes require a logged-in user.

| Method | Path | Description | Success |
|---|---|---|---|
| POST | `/api/auth/register` | Create a user (`username`, `password`), hash the password, start a session. | 201 |
| POST | `/api/auth/login` | Log in with `username` and `password`; starts a session. | 200 |
| POST | `/api/auth/logout` | End the session and clear the cookie. | 200 |
| GET | `/api/auth/me` | Return the logged-in user, or 401 if not logged in. | 200 |

## Games

All of these require a logged-in user (401 otherwise). Game responses never
include the opponent's un-hit ship positions.

| Method | Path | Description | Success |
|---|---|---|---|
| GET | `/api/games` | List games waiting for a second player, plus games the user is in (boards omitted). | 200 |
| POST | `/api/games` | Create a game; the user becomes player 1 and gets a random board. | 201 |
| GET | `/api/games/:id` | Get one game, with the opponent's board hidden for the viewer. | 200 |
| POST | `/api/games/:id/join` | Join a waiting game as player 2 (gets a random board; game becomes active). | 200 |
| POST | `/api/games/:id/shots` | Fire a shot at `{ row, col }` on your turn. Applies the shot, checks for a win, switches turns. | 200 |

## Status codes

- `200` success, `201` created.
- `400` invalid input (e.g. missing fields, non-numeric coordinates).
- `401` not logged in, or wrong credentials on login.
- `403` logged in, but not a player in that game.
- `404` no game with that id.
- `409` username taken, game not open to join, or not your turn.

## A game document

{
player1, player2, // user ids
board1, board2, // each a 10x10 array from arcade-core
turn, // whose turn (a user id)
status, // 'waiting' | 'active' | 'complete'
winner, // user id, or null
createdAt
}


Each cell is `"empty"`, `"ship"`, `"hit"`, or `"miss"`.

## Project structure
```
.
├── server.js # Hono server: auth + game routes
├── db.js # MongoDB connection
├── auth.js # bcrypt password hashing helpers
├── models/
│ ├── games.js # game state + board hiding  
│ ├── sessions.js # session create/find/delete
│ └── users.js # user + session-independent user lookups
├── .env # MONGODB_URI (gitignored)
└── .gitignore
```

## Built with

- [Hono](https://hono.dev/), `@hono/node-server`, `hono/cookie`
- MongoDB (Node driver)
- bcrypt
- [@april-cs-npm/arcade-core](https://www.npmjs.com/package/@april-cs-npm/arcade-core)

## Deployment

Deployed on Render. Set `MONGODB_URI` in the Render dashboard (not in a file).
Build: `npm install`. Start: `npm start`. The free tier sleeps when idle, so
the first request after inactivity may take up to a minute.