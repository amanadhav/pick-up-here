'use strict';

/**
 * Schema validators for AI layer responses.
 * Each function throws a plain Error with a `field` property on failure.
 */

const VALID_STATUSES = new Set(['in_bag', 'outside_bag', 'unclear']);

/**
 * Throws a structured error.
 * @param {string} message
 * @param {string} field
 */
function fail(message, field) {
  const err = new Error(message);
  err.field = field;
  throw err;
}

/**
 * Validates a generateRoutine response.
 * @param {unknown} data
 */
function validateGenerateRoutine(data) {
  if (!data || !Array.isArray(data.steps) || data.steps.length === 0) {
    fail('steps must be a non-empty array', 'steps');
  }

  const seenIds = new Set();
  for (let i = 0; i < data.steps.length; i++) {
    const step = data.steps[i];
    if (!step.id || typeof step.id !== 'string') {
      fail(`steps[${i}] is missing a valid id`, `steps[${i}].id`);
    }
    if (!step.action || typeof step.action !== 'string') {
      fail(`steps[${i}] is missing a valid action`, `steps[${i}].action`);
    }
    if (step.photoRef === undefined || step.photoRef === null) {
      fail(`steps[${i}] is missing photoRef`, `steps[${i}].photoRef`);
    }
    if (seenIds.has(step.id)) {
      fail(`Duplicate step id: ${step.id}`, `steps[${i}].id`);
    }
    seenIds.add(step.id);
  }
}

/**
 * Validates an analyseResume response.
 * @param {unknown} data
 * @param {string[]} stepIds - valid step IDs from the routine
 */
function validateAnalyseResume(data, stepIds) {
  if (!data || !Array.isArray(data.observations) || data.observations.length === 0) {
    fail('observations must be a non-empty array', 'observations');
  }

  const validIds = new Set(stepIds);

  for (let i = 0; i < data.observations.length; i++) {
    const obs = data.observations[i];
    if (!obs.stepId || typeof obs.stepId !== 'string') {
      fail(`observations[${i}] is missing a valid stepId`, `observations[${i}].stepId`);
    }
    if (!obs.status || typeof obs.status !== 'string') {
      fail(`observations[${i}] is missing status`, `observations[${i}].status`);
    }
    if (!VALID_STATUSES.has(obs.status)) {
      fail(
        `observations[${i}] has unknown status: ${obs.status}`,
        `observations[${i}].status`
      );
    }
    if (!obs.visualReason || typeof obs.visualReason !== 'string') {
      fail(`observations[${i}] is missing visualReason`, `observations[${i}].visualReason`);
    }
    if (!validIds.has(obs.stepId)) {
      fail(
        `observations[${i}] has unknown stepId: ${obs.stepId}`,
        `observations[${i}].stepId`
      );
    }
  }

  if (data.nextAction !== undefined && data.nextQuestion !== undefined &&
      data.nextAction !== null && data.nextQuestion !== null) {
    fail('nextAction and nextQuestion cannot both be non-null', 'nextAction');
  }
}

module.exports = { validateGenerateRoutine, validateAnalyseResume };
