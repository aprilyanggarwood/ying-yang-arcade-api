// a simple password hashing helpers (bcrypt)
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// hash a plain password before storing it
export async function hashPassword(plain) {
  return await bcrypt.hash(plain, SALT_ROUNDS);
}

// check a plain password against a stored hash; returns true/false
export async function verifyPassword(plain, hash) {
  return await bcrypt.compare(plain, hash);
}