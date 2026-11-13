// cs5610_project3_ying-yang-arcade-api — Battleship backend
// Author: April Yang
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { db } from './db.js'; // import runs the MongoDB connection


const app = new Hono();

app.get('/', (c) => c.text('Arcade API is running'));



serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 });
console.log('http://localhost:3000');