// models/games.js
import { db } from '../db.js';
import { ObjectId } from 'mongodb';
import { createRandomBoard } from '@april-cs-npm/arcade-core';

const games = db.collection('games');

// create a new game with player1's board; player2 joins later
export async function createGame(player1Id) {
  const game = {
    player1: player1Id,
    player2: null,
    board1: createRandomBoard(),   // player 1's ships, placed randomly
    board2: null,
    turn: player1Id,               // player 1 goes first
    status: 'waiting',
    winner: null,
    createdAt: new Date(),
  };
  const result = await games.insertOne(game);
  return { _id: result.insertedId, ...game };
}


// list open games (waiting) plus games this user is in — without the boards
export async function listGames(userId) {
  return await games
    .find({
      $or: [
        { status: 'waiting' },     // joinable games
        { player1: userId },       // my games
        { player2: userId },
      ],
    })
    .project({ board1: 0, board2: 0 })   // omit boards from the list
    .toArray();
}

// find one game by id (or null)
export async function findGame(id) {
  if (!ObjectId.isValid(id)) return null;
  return await games.findOne({ _id: new ObjectId(id) });
}

// set player2, generate their board, activate the game
export async function joinGame(id, player2Id) {
  await games.updateOne(
    { _id: new ObjectId(id) },
    { $set: {
        player2: player2Id,
        board2: createRandomBoard(),
        status: 'active',
      } }
  );
  return await findGame(id);
}