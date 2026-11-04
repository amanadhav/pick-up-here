'use strict';

const OpenAI = require('openai');
const { validateGenerateRoutine, validateAnalyseResume } = require('./schema');

let _client = null;

function getClient() {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const GENERATE_ROUTINE_SYSTEM_PROMPT = `You are an assistant that analyses photos of a task being performed and produces a structured packing routine.

Return ONLY valid JSON — no markdown fences, no commentary, no extra text.

The JSON must match this exact shape:
{
  "steps": [
    { "id": "step_1", "action": "<short imperative action>", "photoRef": 0 }
  ]
}

Rules:
- steps must be a non-empty array.
- Each step must have a unique string id (e.g. step_1, step_2, …).
- photoRef is the 0-based index of the photo that best illustrates that step.
- action is a short imperative sentence, e.g. "Put the textbook in the bag".`;

const ANALYSE_RESUME_SYSTEM_PROMPT = `You are an assistant that analyses a photo of a partially-packed bag and determines the status of each item in the packing routine.

Return ONLY valid JSON — no markdown fences, no commentary, no extra text.

The JSON must match this exact shape:
{
  "observations": [
    {
      "stepId": "step_1",
      "status": "in_bag | outside_bag | unclear",
      "visualReason": "<one sentence explaining what you can see>"
    }
  ],
  "nextQuestion": null,
  "nextAction": "<short instruction, or null>"
}

Rules:
- observations must be a non-empty array with one entry per step.
- status must be exactly one of: in_bag, outside_bag, unclear.
- Set nextAction to a short instruction when the next step is clear (e.g. an item is visibly outside).
- Set nextQuestion when the status is unclear and you need the user to confirm.
- nextAction and nextQuestion must not both be non-null.`;

/**
 * Converts a Buffer + mime type to a base64 data URL string.
 * Never logs the buffer contents.
 */
function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Builds the image content parts for a GPT-4o message from an array of photo objects.
 * @param {{ buffer: Buffer, mimeType: string }[]} photos
 */
function buildImageParts(photos) {
  return photos.map((photo) => ({
    type: 'image_url',
    image_url: { url: bufferToDataUrl(photo.buffer, photo.mimeType), detail: 'low' },
  }));
}

/**
 * Calls GPT-4o to generate a bag-packing routine from teaching photos.
 * @param {{ buffer: Buffer, mimeType: string }[]} photos
 * @param {string[]} notes
 * @returns {Promise<{ data: object, mode: 'live' }>}
 */
async function generateRoutine(photos, notes) {
  const notesText = notes && notes.length
    ? `\n\nNotes from the user:\n${notes.map((n, i) => `Photo ${i + 1}: ${n || '(none)'}`).join('\n')}`
    : '';

  const userContent = [
    {
      type: 'text',
      text: `Here are ${photos.length} teaching photos showing the bag-packing routine in order.${notesText}\n\nReturn the routine JSON.`,
    },
    ...buildImageParts(photos),
  ];

  let raw;
  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: GENERATE_ROUTINE_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 512,
    });
    raw = response.choices[0]?.message?.content ?? '';
  } catch (apiErr) {
    const err = new Error(`OpenAI API error: ${apiErr.message}`);
    err.retryable = true;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error('Model returned non-JSON output for generateRoutine');
    err.retryable = true;
    throw err;
  }

  try {
    validateGenerateRoutine(data);
  } catch (validationErr) {
    const err = new Error(`generateRoutine validation failed: ${validationErr.message}`);
    err.retryable = true;
    throw err;
  }

  return { data, mode: 'live' };
}

/**
 * Calls GPT-4o to analyse a fresh photo against an existing routine.
 * @param {object} routine - saved routine with steps array (and optional teachingPhotos)
 * @param {{ buffer: Buffer, mimeType: string }} freshPhoto
 * @param {object} confirmations - map of stepId → 'yes' | 'no' | 'unsure'
 * @returns {Promise<{ data: object, mode: 'live' }>}
 */
async function analyseResume(routine, freshPhoto, confirmations) {
  const stepsText = routine.steps
    .map((s) => `- ${s.id}: ${s.action}`)
    .join('\n');

  const confirmedText = confirmations && Object.keys(confirmations).length
    ? '\n\nUser confirmations so far:\n' +
      Object.entries(confirmations)
        .map(([id, ans]) => `- ${id}: ${ans}`)
        .join('\n')
    : '';

  const userContent = [
    {
      type: 'text',
      text: `Routine steps:\n${stepsText}${confirmedText}\n\nHere is the current photo. Analyse it and return the JSON.`,
    },
    {
      type: 'image_url',
      image_url: { url: bufferToDataUrl(freshPhoto.buffer, freshPhoto.mimeType), detail: 'low' },
    },
  ];

  // Attach reference teaching photos if available
  if (routine.teachingPhotos && routine.teachingPhotos.length) {
    userContent.push({ type: 'text', text: 'Reference teaching photos (in routine order):' });
    userContent.push(...buildImageParts(routine.teachingPhotos));
  }

  let raw;
  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: ANALYSE_RESUME_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1024,
    });
    raw = response.choices[0]?.message?.content ?? '';
  } catch (apiErr) {
    const err = new Error(`OpenAI API error: ${apiErr.message}`);
    err.retryable = true;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error('Model returned non-JSON output for analyseResume');
    err.retryable = true;
    throw err;
  }

  const stepIds = routine.steps.map((s) => s.id);
  try {
    validateAnalyseResume(data, stepIds);
  } catch (validationErr) {
    const err = new Error(`analyseResume validation failed: ${validationErr.message}`);
    err.retryable = true;
    throw err;
  }

  return { data, mode: 'live' };
}

module.exports = { generateRoutine, analyseResume };
