import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { nextAction } = require('../../src/logic/nextAction');

const STEPS = [
  { id: 'step_1', action: 'Put the textbook in the bag', photoRef: 0 },
  { id: 'step_2', action: 'Put the notebook in the bag', photoRef: 1 },
  { id: 'step_3', action: 'Pack the laptop charger', photoRef: 2 },
  { id: 'step_4', action: 'Zip up the bag', photoRef: 3 },
];

describe('nextAction()', () => {
  it('1. item confirmed yes is skipped — next unresolved step returned', () => {
    const result = nextAction({
      steps: STEPS,
      observations: {},
      confirmations: { step_1: 'yes', step_2: 'yes' },
      conflicts: [],
    });
    expect(result.type).toBe('question');
    expect(result.stepId).toBe('step_3');
  });

  it('2. item with outside_bag observation → action message', () => {
    const result = nextAction({
      steps: STEPS,
      observations: { step_1: { status: 'outside_bag', visualReason: 'Textbook on desk' } },
      confirmations: {},
      conflicts: [],
    });
    expect(result.type).toBe('action');
    expect(result.stepId).toBe('step_1');
    expect(result.message).toContain('outside the bag');
  });

  it('3. item with unclear observation → question message', () => {
    const result = nextAction({
      steps: STEPS,
      observations: { step_1: { status: 'unclear', visualReason: 'Not visible' } },
      confirmations: {},
      conflicts: [],
    });
    expect(result.type).toBe('question');
    expect(result.stepId).toBe('step_1');
    expect(result.message).toContain('Can you see');
  });

  it('4. item with no observation → question message', () => {
    const result = nextAction({
      steps: STEPS,
      observations: {},
      confirmations: {},
      conflicts: [],
    });
    expect(result.type).toBe('question');
    expect(result.stepId).toBe('step_1');
    expect(result.message).toContain('Can you see');
  });

  it('5. confirmation no → action message to pack it', () => {
    const result = nextAction({
      steps: STEPS,
      observations: {},
      confirmations: { step_1: 'no' },
      conflicts: [],
    });
    expect(result.type).toBe('action');
    expect(result.stepId).toBe('step_1');
    expect(result.message).toContain('not in the bag yet');
  });

  it('6. confirmation unsure → check message', () => {
    const result = nextAction({
      steps: STEPS,
      observations: {},
      confirmations: { step_1: 'unsure' },
      conflicts: [],
    });
    expect(result.type).toBe('check');
    expect(result.stepId).toBe('step_1');
    expect(result.message).toContain('To check');
  });

  it('7. conflict (outside_bag + confirmed yes) → conflict message', () => {
    const result = nextAction({
      steps: STEPS,
      observations: { step_3: { status: 'outside_bag', visualReason: 'Charger on desk' } },
      confirmations: { step_3: 'yes' },
      conflicts: ['step_3'],
    });
    expect(result.type).toBe('conflict');
    expect(result.stepId).toBe('step_3');
    expect(result.message).toContain('photo suggests otherwise');
  });

  it('8. all items resolved → done message', () => {
    const result = nextAction({
      steps: STEPS,
      observations: {
        step_1: { status: 'in_bag' },
        step_2: { status: 'in_bag' },
        step_3: { status: 'in_bag' },
        step_4: { status: 'in_bag' },
      },
      confirmations: {},
      conflicts: [],
    });
    expect(result.type).toBe('done');
    expect(result.message).toContain('Double-check the zip');
  });

  it('9. item with in_bag observation and no confirmation → treated as resolved (next step returned)', () => {
    const result = nextAction({
      steps: STEPS,
      observations: { step_1: { status: 'in_bag', visualReason: 'Visible inside bag' } },
      confirmations: {},
      conflicts: [],
    });
    // step_1 is resolved by in_bag observation, so step_2 should be next
    expect(result.stepId).toBe('step_2');
    expect(result.type).toBe('question');
  });
});
