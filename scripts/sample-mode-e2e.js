'use strict';

/**
 * Sample Mode end-to-end test.
 * Runs through the full flow using supertest (no browser required, no real key needed).
 *
 * Usage: node scripts/sample-mode-e2e.js
 */

const fs = require('fs');
const path = require('path');

// Force sample mode — unset the key before loading the AI module
delete process.env.OPENAI_API_KEY;

const supertest = require('supertest');
const app = require('../src/server.js');

// ── Minimal 1×1 transparent PNG ───────────────────────────────────────────────
const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence');

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

(async () => {
  ensureEvidenceDir();

  const lines = [];
  function log(msg) {
    console.log(msg);
    lines.push(msg);
  }

  log('=== Sample Mode End-to-End Run ===');
  log(`Timestamp: ${new Date().toISOString()}`);
  log('');

  const agent = supertest.agent(app);

  let routineId;

  try {
    // ── Step 1: POST /api/routine/generate ────────────────────────────────────
    log('STEP 1: POST /api/routine/generate (4 fake photo buffers)');
    const generateRes = await agent
      .post('/api/routine/generate')
      .attach('photo_0', FAKE_PNG, { filename: 'photo0.png', contentType: 'image/png' })
      .attach('photo_1', FAKE_PNG, { filename: 'photo1.png', contentType: 'image/png' })
      .attach('photo_2', FAKE_PNG, { filename: 'photo2.png', contentType: 'image/png' })
      .attach('photo_3', FAKE_PNG, { filename: 'photo3.png', contentType: 'image/png' });

    log(`  HTTP Status: ${generateRes.status}`);
    if (generateRes.status !== 200) {
      log(`  ERROR: ${JSON.stringify(generateRes.body)}`);
      throw new Error(`generate failed: ${generateRes.status}`);
    }
    const steps = generateRes.body.steps;
    log(`  Mode: ${generateRes.body.mode}`);
    log(`  Steps returned: ${steps.length}`);
    steps.forEach((s) => log(`    ${s.id}: ${s.action}`));
    log('');

    // ── Step 2: POST /api/routine/save ────────────────────────────────────────
    log('STEP 2: POST /api/routine/save');
    const saveRes = await agent
      .post('/api/routine/save')
      .send({ name: 'E2E Test Routine', steps });

    log(`  HTTP Status: ${saveRes.status}`);
    if (saveRes.status !== 200) {
      log(`  ERROR: ${JSON.stringify(saveRes.body)}`);
      throw new Error(`save failed: ${saveRes.status}`);
    }
    routineId = saveRes.body.id;
    log(`  Saved routineId: ${routineId}`);
    log('');

    // ── Step 3: POST /api/session/resume ──────────────────────────────────────
    log("STEP 3: POST /api/session/resume (preset: charger-on-desk)");
    const resumeRes = await agent
      .post('/api/session/resume')
      .field('routineId', routineId)
      .field('preset', 'charger-on-desk')
      .attach('photo', FAKE_PNG, { filename: 'resume.png', contentType: 'image/png' });

    log(`  HTTP Status: ${resumeRes.status}`);
    if (resumeRes.status !== 200) {
      log(`  ERROR: ${JSON.stringify(resumeRes.body)}`);
      throw new Error(`resume failed: ${resumeRes.status}`);
    }
    log(`  Mode: ${resumeRes.body.mode}`);
    log(`  nextResult.type: ${resumeRes.body.nextResult.type}`);
    log(`  nextResult.stepId: ${resumeRes.body.nextResult.stepId}`);
    log(`  nextResult.message: ${resumeRes.body.nextResult.message}`);
    log('');

    // ── Step 4: POST /api/session/confirm { stepId: 'step_3', answer: 'yes' } ─
    log("STEP 4: POST /api/session/confirm { stepId: 'step_3', answer: 'yes' }");
    const confirm3Res = await agent
      .post('/api/session/confirm')
      .send({ stepId: 'step_3', answer: 'yes' });

    log(`  HTTP Status: ${confirm3Res.status}`);
    if (confirm3Res.status !== 200) {
      log(`  ERROR: ${JSON.stringify(confirm3Res.body)}`);
      throw new Error(`confirm step_3 failed: ${confirm3Res.status}`);
    }
    const step3Entry = confirm3Res.body.checklist.find((c) => c.stepId === 'step_3');
    log(`  step_3 confirmation: ${step3Entry?.confirmation}`);
    log(`  nextResult.type: ${confirm3Res.body.nextResult.type}`);
    log(`  nextResult.stepId: ${confirm3Res.body.nextResult.stepId}`);
    log('');

    // ── Step 5: POST /api/session/confirm { stepId: 'step_4', answer: 'yes' } ─
    log("STEP 5: POST /api/session/confirm { stepId: 'step_4', answer: 'yes' }");
    const confirm4Res = await agent
      .post('/api/session/confirm')
      .send({ stepId: 'step_4', answer: 'yes' });

    log(`  HTTP Status: ${confirm4Res.status}`);
    if (confirm4Res.status !== 200) {
      log(`  ERROR: ${JSON.stringify(confirm4Res.body)}`);
      throw new Error(`confirm step_4 failed: ${confirm4Res.status}`);
    }
    const step4Entry = confirm4Res.body.checklist.find((c) => c.stepId === 'step_4');
    log(`  step_4 confirmation: ${step4Entry?.confirmation}`);
    log(`  nextResult.type: ${confirm4Res.body.nextResult.type}`);
    log('');

    // ── Step 6: GET /api/session/state ────────────────────────────────────────
    log('STEP 6: GET /api/session/state');
    const stateRes = await agent.get('/api/session/state');

    log(`  HTTP Status: ${stateRes.status}`);
    if (stateRes.status !== 200) {
      log(`  ERROR: ${JSON.stringify(stateRes.body)}`);
      throw new Error(`state failed: ${stateRes.status}`);
    }
    log(`  Mode: ${stateRes.body.mode}`);
    log(`  nextResult.type: ${stateRes.body.nextResult.type}`);
    log('');
    log('  Final checklist:');
    for (const item of stateRes.body.checklist) {
      const obs = item.observedStatus || 'no obs';
      const conf = item.confirmation || 'none';
      log(`    ${item.stepId}: observed=${obs}, confirmed=${conf}`);
    }
    log('');
    log('=== Sample Mode E2E: PASSED ===');

  } catch (err) {
    log('');
    log(`=== Sample Mode E2E: FAILED — ${err.message} ===`);
    process.exitCode = 1;
  }

  // Save output to evidence
  const outPath = path.join(EVIDENCE_DIR, 'sample-mode-run.txt');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

  process.exit(process.exitCode || 0);
})();
