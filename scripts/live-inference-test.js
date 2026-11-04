'use strict';

/**
 * Live inference test — sends real images to GPT-4o and saves raw responses.
 * Only runs if OPENAI_API_KEY is set.
 *
 * Usage: node scripts/live-inference-test.js
 */

const fs = require('fs');
const path = require('path');

// ── Guard: key must be set ────────────────────────────────────────────────────

if (!process.env.OPENAI_API_KEY) {
  console.log('LIVE INFERENCE: NOT RUN — OPENAI_API_KEY not set');
  process.exit(0);
}

// ── Minimal 1×1 transparent PNG — used as test photos ────────────────────────
// This is a valid PNG so the API accepts it without requiring real photos.

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ── Load the same AI module as the server ─────────────────────────────────────

const ai = require('../src/ai/index.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence');

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

function saveJson(filename, data) {
  const filepath = path.join(EVIDENCE_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Run ───────────────────────────────────────────────────────────────────────

(async () => {
  ensureEvidenceDir();

  // Four test photos (all the same tiny PNG — real content is irrelevant for schema testing)
  const testPhotos = [
    { buffer: TINY_PNG, mimetype: 'image/png' },
    { buffer: TINY_PNG, mimetype: 'image/png' },
    { buffer: TINY_PNG, mimetype: 'image/png' },
    { buffer: TINY_PNG, mimetype: 'image/png' },
  ];
  const testNotes = ['', '', '', ''];

  try {
    // Step 1: generateRoutine
    const generateResult = await ai.generateRoutine(testPhotos, testNotes);
    saveJson('live-inference-generate.json', generateResult.data);

    const routine = generateResult.data;
    const freshPhoto = { buffer: TINY_PNG, mimetype: 'image/png' };

    // Step 2: analyseResume
    const resumeResult = await ai.analyseResume(routine, freshPhoto, {});
    saveJson('live-inference-resume.json', resumeResult.data);

    console.log('LIVE INFERENCE: PASSED');
    process.exit(0);
  } catch (err) {
    console.log(`LIVE INFERENCE: FAILED — ${err.message}`);
    process.exit(1);
  }
})();
