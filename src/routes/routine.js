'use strict';

const { Router } = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const ai = require('../ai');
const { validateGenerateRoutine } = require('../ai/schema');

const router = Router();

// Memory storage — no disk writes
const upload = multer({ storage: multer.memoryStorage() });
const photoFields = [
  { name: 'photo_0', maxCount: 1 },
  { name: 'photo_1', maxCount: 1 },
  { name: 'photo_2', maxCount: 1 },
  { name: 'photo_3', maxCount: 1 },
];

// POST /api/routine/generate
router.post(
  '/generate',
  upload.fields(photoFields),
  async (req, res) => {
    const files = req.files || {};
    const photos = ['photo_0', 'photo_1', 'photo_2', 'photo_3'].map((n) => files[n]?.[0]);

    if (photos.some((f) => !f)) {
      return res.status(400).json({ error: 'All 4 photos (photo_0–photo_3) are required.', retryable: false });
    }

    const photoBuffers = photos.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype }));
    const notes = [0, 1, 2, 3].map((i) => (req.body[`note_${i}`] || '').toString());

    try {
      const result = await ai.generateRoutine(photoBuffers, notes);
      return res.status(200).json({ steps: result.data.steps, mode: result.mode });
    } catch (err) {
      return res.status(502).json({ error: err.message, retryable: err.retryable ?? true });
    }
  }
);

// POST /api/routine/save
router.post('/save', (req, res) => {
  const { name, steps } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name must be a non-empty string.', retryable: false });
  }

  try {
    validateGenerateRoutine({ steps });
  } catch (err) {
    return res.status(400).json({ error: err.message, retryable: false });
  }

  const session = req.app.locals.sessions.get(req.sessionId);
  const id = uuidv4();
  session.routines.set(id, { id, name: name.trim(), steps, createdAt: new Date().toISOString() });

  return res.status(200).json({ id, name: name.trim() });
});

module.exports = router;
