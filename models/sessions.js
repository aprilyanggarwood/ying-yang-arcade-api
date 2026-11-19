// session storage (the server side of "logged in")
import { db } from '../db.js';
import { randomBytes } from 'node:crypto';

const sessions = db.collection('sessions');

// make a new session for a user; returns the new session id
export async function createSession(userId) {
  // a long random, unguessable id
  const sessionId = randomBytes(24).toString('hex');
  await sessions.insertOne({
    sessionId,
    userId,
    createdAt: new Date(),
  });
  return sessionId;
}

// look up a session by its id; returns the session doc or null
export async function findSession(sessionId) {
  if (!sessionId) return null;
  return await sessions.findOne({ sessionId });
}

// delete one session (used on logout)
export async function deleteSession(sessionId) {
  await sessions.deleteOne({ sessionId });
}