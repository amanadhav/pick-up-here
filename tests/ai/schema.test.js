import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateGenerateRoutine, validateAnalyseResume } = require('../../src/ai/schema');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validRoutineData() {
  return {
    steps: [
      { id: 'step_1', action: 'Put the textbook in the bag', photoRef: 0 },
      { id: 'step_2', action: 'Put the notebook in the bag', photoRef: 1 },
      { id: 'step_3', action: 'Pack the laptop charger', photoRef: 2 },
      { id: 'step_4', action: 'Zip up the bag', photoRef: 3 },
    ],
  };
}

function validAnalyseData() {
  return {
    observations: [
      { stepId: 'step_1', status: 'in_bag', visualReason: 'Textbook spine visible' },
      { stepId: 'step_2', status: 'in_bag', visualReason: 'Notebook cover visible' },
      { stepId: 'step_3', status: 'outside_bag', visualReason: 'Charger coiled on desk' },
      { stepId: 'step_4', status: 'unclear', visualReason: 'Zip not in frame' },
    ],
    nextQuestion: null,
    nextAction: 'Pack the charger',
  };
}

const STEP_IDS = ['step_1', 'step_2', 'step_3', 'step_4'];

// ---------------------------------------------------------------------------
// generateRoutine validation
// ---------------------------------------------------------------------------

describe('validateGenerateRoutine', () => {
  it('1. passes without error for a valid response', () => {
    expect(() => validateGenerateRoutine(validRoutineData())).not.toThrow();
  });

  it('2. throws a structured error when a step is missing id', () => {
    const data = validRoutineData();
    delete data.steps[1].id;
    let err;
    try {
      validateGenerateRoutine(data);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(Error);
    expect(err.field).toBeDefined();
    expect(err.field).toMatch(/steps\[1\]\.id/);
  });

  it('3. throws a structured error for non-unique step IDs', () => {
    const data = validRoutineData();
    data.steps[2].id = 'step_1'; // duplicate
    let err;
    try {
      validateGenerateRoutine(data);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(Error);
    expect(err.field).toBeDefined();
    expect(err.message).toMatch(/duplicate/i);
  });
});

// ---------------------------------------------------------------------------
// analyseResume validation
// ---------------------------------------------------------------------------

describe('validateAnalyseResume', () => {
  it('4. passes without error for a valid response', () => {
    expect(() => validateAnalyseResume(validAnalyseData(), STEP_IDS)).not.toThrow();
  });

  it('5. throws a structured error for an unknown status value', () => {
    const data = validAnalyseData();
    data.observations[2].status = 'missing'; // invalid
    let err;
    try {
      validateAnalyseResume(data, STEP_IDS);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(Error);
    expect(err.field).toBeDefined();
    expect(err.field).toMatch(/status/);
  });

  it('6. throws a structured error when an observation stepId is not in the routine', () => {
    const data = validAnalyseData();
    data.observations[0].stepId = 'step_99'; // not in routine
    let err;
    try {
      validateAnalyseResume(data, STEP_IDS);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(Error);
    expect(err.field).toBeDefined();
    expect(err.message).toMatch(/step_99/);
  });

  it('7. throws a structured error when both nextAction and nextQuestion are non-null', () => {
    const data = validAnalyseData();
    data.nextAction = 'Pack the charger';
    data.nextQuestion = 'Is the charger in the bag?';
    let err;
    try {
      validateAnalyseResume(data, STEP_IDS);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(Error);
    expect(err.field).toBeDefined();
    expect(err.field).toMatch(/nextAction/);
  });
});
