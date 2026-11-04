'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const routineRouter = require('./routes/routine');
const sessionRouter = require('./routes/session');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Shared in-memory state ────────────────────────────────────────────────────
// Each browser session is keyed by a UUID stored in a cookie named "sid".
// Value shape: { routines: Map, progress: null, lastPhoto: null }
app.locals.sessions = new Map();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Cookie-based session ID — no express-session, just a UUID cookie.
app.use((req, _res, next) => {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)sid=([^;]+)/);
  req.sessionId = match ? match[1] : null;
  next();
});

// Ensure every request has a live session entry; set the cookie if new.
app.use((req, res, next) => {
  if (!req.sessionId || !app.locals.sessions.has(req.sessionId)) {
    const sid = uuidv4();
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
    req.sessionId = sid;
    app.locals.sessions.set(sid, { routines: new Map(), progress: null, lastPhoto: null, confirmations: {} });
  }
  next();
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/routine', routineRouter);
app.use('/api/session', sessionRouter);

// GET /api/routines — separate from /api/routine to avoid prefix conflict
app.get('/api/routines', (req, res) => {
  const session = app.locals.sessions.get(req.sessionId);
  const routines = session
    ? Array.from(session.routines.values()).map(({ id, name }) => ({ id, name }))
    : [];
  res.status(200).json({ routines });
});

// ── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Pick Up Here running at http://localhost:${PORT}`);
});

module.exports = app; // exported for supertest
