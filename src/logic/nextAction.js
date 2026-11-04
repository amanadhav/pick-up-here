'use strict';

/**
 * Pure function — no I/O, no Express.
 *
 * Determines the next user-facing action based on the current state of a
 * packing routine.
 *
 * @param {object} params
 * @param {Array<{id: string, action: string}>} params.steps
 * @param {Object.<string, {status: string, visualReason?: string}>} params.observations
 * @param {Object.<string, 'yes'|'no'|'unsure'>} params.confirmations
 * @param {string[]} params.conflicts - stepIds that have a conflict
 * @returns {{ type: string, stepId?: string, message: string }}
 */
function nextAction({ steps, observations = {}, confirmations = {}, conflicts = [] }) {
  // 1. If there are any conflicts, surface the first one
  for (const step of steps) {
    if (conflicts.includes(step.id)) {
      return {
        type: 'conflict',
        stepId: step.id,
        message: `You confirmed this step but the photo suggests otherwise. Did you pack ${step.action}? You can keep your answer, correct it, or say not sure.`,
      };
    }
  }

  // 2 & 3. Walk steps to find first unresolved
  for (const step of steps) {
    const confirmation = confirmations[step.id];
    const observation = observations[step.id];

    // Skip steps confirmed 'yes' (or in_bag observation with no conflicting info)
    if (confirmation === 'yes') continue;
    if (!confirmation && observation?.status === 'in_bag') continue;

    // Found an unresolved step — determine message
    if (confirmation === 'no') {
      const item = step.action
        .replace(/^Pack\s+/i, '')
        .replace(/^Put\s+/i, '')
        .replace(/\s+in the bag$/i, '');
      return {
        type: 'action',
        stepId: step.id,
        message: `Pack the ${item} — you said it is not in the bag yet.`,
      };
    }

    if (confirmation === 'unsure') {
      const item = step.action
        .replace(/^Pack\s+/i, '')
        .replace(/^Put\s+/i, '')
        .replace(/\s+in the bag$/i, '');
      return {
        type: 'check',
        stepId: step.id,
        message: `Check your bag for the ${item}. Try the main compartment and any side pockets.`,
      };
    }

    if (observation?.status === 'outside_bag') {
      const item = step.action
        .replace(/^Pack\s+/i, '')
        .replace(/^Put\s+/i, '')
        .replace(/\s+in the bag$/i, '');
      return {
        type: 'action',
        stepId: step.id,
        message: `Pack the ${item} — it appears to be outside the bag.`,
      };
    }

    // unclear or no observation
    {
      const item = step.action
        .replace(/^Pack\s+/i, '')
        .replace(/^Put\s+/i, '')
        .replace(/\s+in the bag$/i, '');
      return {
        type: 'question',
        stepId: step.id,
        message: `Check your bag for the ${item}. Is it already inside?`,
      };
    }
  }

  // 4. All steps resolved
  return { type: 'done', message: 'Everything looks packed! Double-check the zip.' };
}

module.exports = { nextAction };
