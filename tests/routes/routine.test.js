import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../../src/server');

// A minimal 1×1 PNG buffer — valid image content for multer
const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Fixture steps matching the sample-mode fixture
const SAMPLE_STEPS = [
  { id: 'step_1', action: 'Put the textbook in the bag', photoRef: 0 },
  { id: 'step_2', action: 'Put the notebook in the bag', photoRef: 1 },
  { id: 'step_3', action: 'Pack the laptop charger', photoRef: 2 },
  { id: 'step_4', action: 'Zip up the bag', photoRef: 3 },
];

// ---------------------------------------------------------------------------
// POST /api/routine/generate
// ---------------------------------------------------------------------------

describe('POST /api/routine/generate', () => {
  it('1. returns 200 with steps and mode when 4 photos are uploaded', async () => {
    const res = await request(app)
      .post('/api/routine/generate')
      .attach('photo_0', FAKE_PNG, { filename: 'p0.png', contentType: 'image/png' })
      .attach('photo_1', FAKE_PNG, { filename: 'p1.png', contentType: 'image/png' })
      .attach('photo_2', FAKE_PNG, { filename: 'p2.png', contentType: 'image/png' })
      .attach('photo_3', FAKE_PNG, { filename: 'p3.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.steps)).toBe(true);
    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(res.body.mode).toBe('sample');
  });

  it('2. returns 400 with retryable:false when fewer than 4 photos are uploaded', async () => {
    const res = await request(app)
      .post('/api/routine/generate')
      .attach('photo_0', FAKE_PNG, { filename: 'p0.png', contentType: 'image/png' })
      .attach('photo_1', FAKE_PNG, { filename: 'p1.png', contentType: 'image/png' })
      .attach('photo_2', FAKE_PNG, { filename: 'p2.png', contentType: 'image/png' });
    // photo_3 is missing

    expect(res.status).toBe(400);
    expect(res.body.retryable).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// POST /api/routine/save
// ---------------------------------------------------------------------------

describe('POST /api/routine/save', () => {
  it('3. returns 200 with id and name when steps and name are valid', async () => {
    const agent = request.agent(app);

    const res = await agent
      .post('/api/routine/save')
      .send({ name: 'School Bag', steps: SAMPLE_STEPS });

    expect(res.status).toBe(200);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);
    expect(res.body.name).toBe('School Bag');
  });

  it('4. returns 400 with retryable:false when steps is an empty array', async () => {
    const res = await request(app)
      .post('/api/routine/save')
      .send({ name: 'Empty Routine', steps: [] });

    expect(res.status).toBe(400);
    expect(res.body.retryable).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GET /api/routines
// ---------------------------------------------------------------------------

describe('GET /api/routines', () => {
  it('5. returns 200 with the saved routine in the array after saving one', async () => {
    // Use a persistent agent so the session cookie is shared across requests
    const agent = request.agent(app);

    // First save a routine
    const saveRes = await agent
      .post('/api/routine/save')
      .send({ name: 'Bag Routine', steps: SAMPLE_STEPS });
    expect(saveRes.status).toBe(200);
    const savedId = saveRes.body.id;

    // Then list routines using the same session
    const listRes = await agent.get('/api/routines');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.routines)).toBe(true);

    const found = listRes.body.routines.find((r) => r.id === savedId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Bag Routine');
  });

  it('6. returns 200 with an empty array when no routines have been saved', async () => {
    // A fresh agent has a new session with no saved routines
    const agent = request.agent(app);

    const res = await agent.get('/api/routines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.routines)).toBe(true);
    expect(res.body.routines.length).toBe(0);
  });
});
