'use strict';

const { validateGenerateRoutine, validateAnalyseResume } = require('./schema');

const fixtureGenerateRoutine = require('./fixtures/generate-routine.json');
const fixtureChargerOnDesk = require('./fixtures/analyse-resume-charger-on-desk.json');
const fixtureChargerUnclear = require('./fixtures/analyse-resume-charger-unclear.json');

/**
 * Returns the fixture generate-routine response after validating it.
 * @param {Buffer[]} _photos - ignored in sample mode
 * @param {string[]} _notes - ignored in sample mode
 * @returns {Promise<{ data: object, mode: 'sample' }>}
 */
async function generateRoutine(_photos, _notes) {
  const data = JSON.parse(JSON.stringify(fixtureGenerateRoutine));
  validateGenerateRoutine(data);
  return { data, mode: 'sample' };
}

/**
 * Returns a fixture analyseResume response after validating it.
 * @param {object} routine - the saved routine (must have a steps array)
 * @param {Buffer} _freshPhoto - ignored in sample mode
 * @param {object} _confirmations - ignored in sample mode
 * @param {'charger-on-desk'|'charger-unclear'} preset
 * @returns {Promise<{ data: object, mode: 'sample' }>}
 */
async function analyseResume(routine, _freshPhoto, _confirmations, preset = 'charger-on-desk') {
  const fixture = preset === 'charger-unclear' ? fixtureChargerUnclear : fixtureChargerOnDesk;
  const data = JSON.parse(JSON.stringify(fixture));
  const stepIds = routine.steps.map((s) => s.id);
  validateAnalyseResume(data, stepIds);
  return { data, mode: 'sample' };
}

module.exports = { generateRoutine, analyseResume };
