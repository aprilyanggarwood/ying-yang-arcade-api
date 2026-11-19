// models/users.js
import { db } from '../db.js';
import { hashPassword } from '../auth.js';
import { ObjectId } from 'mongodb';

const users = db.collection('users');

// create a user with a hashed password; returns the created user (no hash)
export async function createUser(username, password) {
  const passwordHash = await hashPassword(password);
  const result = await users.insertOne({
    username,
    passwordHash,
    createdAt: new Date(),
  });
  return { _id: result.insertedId, username };   // note: no passwordHash returned
}

// find a user by username (includes the hash, for login checks)
export async function findUserByUsername(username) {
  return await users.findOne({ username });
}

// find a user by id; returns the user WITHOUT the password hash
export async function findUserById(id) {
  const user = await users.findOne({ _id: new ObjectId(id) });
  if (!user) return null;
  return { _id: user._id, username: user.username };   // no passwordHash
}