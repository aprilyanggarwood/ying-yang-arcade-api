// models/games.js
import { db } from '../db.js';
import { ObjectId } from 'mongodb';
import { createRandomBoard } from '@april-cs-npm/arcade-core';
import { isValidShot, updateBoard, isGameComplete } from '@april-cs-npm/arcade-core';

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


// apply a shot fired by `shooterId` at (row, col). returns { game, error }
export async function applyShot(game, shooterId, row, col) {
  // which board does this shot hit? the OPPONENT's board.
  const shooterIsP1 = String(game.player1) === String(shooterId);
  const targetBoardField = shooterIsP1 ? 'board2' : 'board1';
  const targetBoard = game[targetBoardField];

  // reject illegal shots (out of bounds or already shot) using arcade-core
  if (!isValidShot(targetBoard, row, col)) {
    return { error: 'invalid shot' };
  }

  // apply the shot -> new board
  const newBoard = updateBoard(targetBoard, row, col);

  // did that finish the game?
  const complete = isGameComplete(newBoard);

  // figure out the next turn (the OTHER player), unless the game is over
  const otherPlayer = shooterIsP1 ? game.player2 : game.player1;

  const update = {
    [targetBoardField]: newBoard,                 // update the right board
    turn: complete ? game.turn : otherPlayer,     // keep turn if over, else switch
    status: complete ? 'complete' : 'active',
    winner: complete ? shooterId : null,
  };

  await games.updateOne({ _id: game._id }, { $set: update });
  return { game: await findGame(game._id) };
}