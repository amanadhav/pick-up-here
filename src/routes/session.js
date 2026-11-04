'use strict';

const { Router } = require('express');
const multer = require('multer');

const ai = require('../ai');
const { nextAction } = require('../logic/nextAction');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a checklist array from routine steps + current state.
 * @param {Array<{id:string,action:string}>} steps
 * @param {object} observations - keyed by stepId
 * @param {object} confirmations - keyed by stepId
 * @param {string[]} conflicts
 * @returns {Array}
 */
function buildChecklist(steps, observations, confirmations, conflicts) {
  return steps.map((step) => ({
    stepId: step.id,
    action: step.action,
    observedStatus: observations[step.id]?.status ?? null,
    confirmation: confirmations[step.id] ?? null,
    conflict: conflicts.includes(step.id),
    visualReason: observations[step.id]?.visualReason ?? null,
  }));
}

/**
 * Detect conflicts: observation says outside_bag but user confirmed yes.
 */
function detectConflicts(observations, confirmations) {
  const conflicts = [];
  for (const [stepId, obs] of Object.entries(observations)) {
    if (obs.status === 'outside_bag' && confirmations[stepId] === 'yes') {
      conflicts.push(stepId);
    }
  }
  return conflicts;
}

// ── POST /api/session/resume ──────────────────────────────────────────────────

router.post('/resume', upload.single('photo'), async (req, res) => {
  const session = req.app.locals.sessions.get(req.sessionId);
  const { routineId, preset } = req.body;
  const file = req.file;

  const routine = session.routines.get(routineId);
  if (!routine) {
    return res.status(404).json({ error: 'Routine not found.', retryable: false });
  }

  const photo = file
    ? { buffer: file.buffer, mimetype: file.mimetype }
    : { buffer: Buffer.alloc(0), mimetype: 'image/png' };

  let data;
  let mode;
  try {
    const result = await ai.analyseResume(routine, photo, session.confirmations, preset);
    data = result.data;
    mode = result.mode;
  } catch (err) {
    return res.status(502).json({ error: err.message, retryable: true });
  }

  // Build observations map from the array
  const observations = {};
  for (const obs of data.observations) {
    observations[obs.stepId] = { status: obs.status, visualReason: obs.visualReason };
  }

  // Store progress — confirmations persist across resume calls
  session.progress = { routineId, observations };
  if (file) {
    session.lastPhoto = photo;
  }

  const conflicts = detectConflicts(observations, session.confirmations);
  const nextResult = nextAction({
    steps: routine.steps,
    observations,
    confirmations: session.confirmations,
    conflicts,
  });

  const checklist = buildChecklist(routine.steps, observations, session.confirmations, conflicts);

  return res.status(200).json({ nextResult, checklist, mode });
});

// ── POST /api/session/confirm ─────────────────────────────────────────────────

router.post('/confirm', (req, res) => {
  const session = req.app.locals.sessions.get(req.sessionId);
  const { stepId, answer } = req.body;

  if (!session.progress) {
    return res.status(400).json({ error: 'No active progress session.', retryable: false });
  }

  const routine = session.routines.get(session.progress.routineId);
  if (!routine) {
    return res.status(400).json({ error: 'Routine no longer found.', retryable: false });
  }

  const stepExists = routine.steps.some((s) => s.id === stepId);
  if (!stepExists) {
    return res.status(400).json({ error: `Unknown stepId: ${stepId}`, retryable: false });
  }

  if (!['yes', 'no', 'unsure'].includes(answer)) {
    return res.status(400).json({ error: 'answer must be yes, no, or unsure.', retryable: false });
  }

  session.confirmations[stepId] = answer;

  const { observations } = session.progress;
  // The user just checked or completed the step after this photo was taken.
  if (answer === 'yes' && observations[stepId]?.status === 'outside_bag') {
    delete observations[stepId];
  }
  const conflicts = detectConflicts(observations, session.confirmations);

  const nextResult = nextAction({
    steps: routine.steps,
    observations,
    confirmations: session.confirmations,
    conflicts,
  });

  const checklist = buildChecklist(routine.steps, observations, session.confirmations, conflicts);

  return res.status(200).json({ nextResult, checklist, mode: ai.mode });
});

// ── POST /api/session/clear ───────────────────────────────────────────────────

router.post('/clear', (req, res) => {
  const session = req.app.locals.sessions.get(req.sessionId);
  const clearAll = req.body?.clearAll === true;

  if (clearAll) {
    session.routines = new Map();
    session.progress = null;
    session.lastPhoto = null;
    session.confirmations = {};
  } else {
    session.progress = null;
    session.lastPhoto = null;
    session.confirmations = {};
  }

  return res.status(200).json({ ok: true });
});

// ── GET /api/session/state ────────────────────────────────────────────────────

router.get('/state', (req, res) => {
  const session = req.app.locals.sessions.get(req.sessionId);

  if (!session.progress) {
    return res.status(200).json({ nextResult: null, checklist: null, mode: ai.mode });
  }

  const routine = session.routines.get(session.progress.routineId);
  if (!routine) {
    return res.status(200).json({ nextResult: null, checklist: null, mode: ai.mode });
  }

  const { observations } = session.progress;
  const conflicts = detectConflicts(observations, session.confirmations);

  const nextResult = nextAction({
    steps: routine.steps,
    observations,
    confirmations: session.confirmations,
    conflicts,
  });

  const checklist = buildChecklist(routine.steps, observations, session.confirmations, conflicts);

  return res.status(200).json({ nextResult, checklist, mode: ai.mode });
});

module.exports = router;
