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

// Fixture steps matching sample-mode fixtures (step IDs must match)
const SAMPLE_STEPS = [
  { id: 'step_1', action: 'Put the textbook in the bag', photoRef: 0 },
  { id: 'step_2', action: 'Put the notebook in the bag', photoRef: 1 },
  { id: 'step_3', action: 'Pack the laptop charger', photoRef: 2 },
  { id: 'step_4', action: 'Zip up the bag', photoRef: 3 },
];

// ---------------------------------------------------------------------------
// Shared agent and routineId — set up once for all session tests
// ---------------------------------------------------------------------------

let agent;
let routineId;

async function setupAgentWithRoutine() {
  agent = request.agent(app);
  const saveRes = await agent
    .post('/api/routine/save')
    .send({ name: 'School Bag', steps: SAMPLE_STEPS });
  expect(saveRes.status).toBe(200);
  routineId = saveRes.body.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/session/resume', () => {
  it('1. valid routineId + sample preset charger-on-desk → 200 with nextResult type action', async () => {
    await setupAgentWithRoutine();

    const res = await agent
      .post('/api/session/resume')
      .field('routineId', routineId)
      .field('preset', 'charger-on-desk')
      .attach('photo', FAKE_PNG, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.nextResult).toBeDefined();
    // charger-on-desk: step_1 and step_2 are in_bag (resolved), step_3 is outside_bag → action
    expect(res.body.nextResult.type).toBe('action');
    expect(res.body.nextResult.stepId).toBe('step_3');
    expect(Array.isArray(res.body.checklist)).toBe(true);
    expect(res.body.mode).toBe('sample');
  });

  it('2. invalid routineId → 404', async () => {
    const freshAgent = request.agent(app);

    const res = await freshAgent
      .post('/api/session/resume')
      .field('routineId', 'non-existent-id')
      .field('preset', 'charger-on-desk')
      .attach('photo', FAKE_PNG, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('POST /api/session/confirm', () => {
  it('3. answer yes on charger step → checklist shows step confirmed', async () => {
    // Use agent from prior test (already has progress from test 1)
    const confirmRes = await agent
      .post('/api/session/confirm')
      .send({ stepId: 'step_3', answer: 'yes' });

    expect(confirmRes.status).toBe(200);
    const chargerEntry = confirmRes.body.checklist.find((c) => c.stepId === 'step_3');
    expect(chargerEntry).toBeDefined();
    expect(chargerEntry.confirmation).toBe('yes');
  });

  it('4. answer no → nextResult type action to pack it', async () => {
    // Use agent from prior test — first clear previous confirmation
    await agent.post('/api/session/confirm').send({ stepId: 'step_3', answer: 'no' });

    const res = await agent
      .post('/api/session/confirm')
      .send({ stepId: 'step_3', answer: 'no' });

    expect(res.status).toBe(200);
    expect(res.body.nextResult.type).toBe('action');
    expect(res.body.nextResult.stepId).toBe('step_3');
    expect(res.body.nextResult.message).toContain('not in the bag yet');
  });
});

describe('POST /api/session/clear', () => {
  it('5. clearAll false → progress resets, routine still exists', async () => {
    const clearAgent = request.agent(app);

    // Save a routine
    const saveRes = await clearAgent
      .post('/api/routine/save')
      .send({ name: 'Test Bag', steps: SAMPLE_STEPS });
    expect(saveRes.status).toBe(200);
    const rid = saveRes.body.id;

    // Start a resume
    await clearAgent
      .post('/api/session/resume')
      .field('routineId', rid)
      .field('preset', 'charger-on-desk')
      .attach('photo', FAKE_PNG, { filename: 'photo.png', contentType: 'image/png' });

    // Clear without clearAll
    const clearRes = await clearAgent
      .post('/api/session/clear')
      .send({ clearAll: false });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.ok).toBe(true);

    // Progress should be gone
    const stateRes = await clearAgent.get('/api/session/state');
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.nextResult).toBeNull();

    // Routine should still exist
    const listRes = await clearAgent.get('/api/routines');
    const found = listRes.body.routines.find((r) => r.id === rid);
    expect(found).toBeDefined();
  });

  it('6. clearAll true → routines also cleared', async () => {
    const clearAgent = request.agent(app);

    // Save a routine
    const saveRes = await clearAgent
      .post('/api/routine/save')
      .send({ name: 'Test Bag', steps: SAMPLE_STEPS });
    expect(saveRes.status).toBe(200);
    const rid = saveRes.body.id;

    // Clear everything
    const clearRes = await clearAgent
      .post('/api/session/clear')
      .send({ clearAll: true });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.ok).toBe(true);

    // Routine should be gone
    const listRes = await clearAgent.get('/api/routines');
    expect(listRes.body.routines.length).toBe(0);
    const found = listRes.body.routines.find((r) => r.id === rid);
    expect(found).toBeUndefined();
  });
});
