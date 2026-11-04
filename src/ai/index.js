'use strict';

const sampleMode = require('./sample-mode');
const openaiClient = require('./openai-client');

const isLive = Boolean(process.env.OPENAI_API_KEY);

let generateRoutine;
let analyseResume;
let mode;

if (isLive) {
  console.log('[AI] Live: GPT-4o');
  generateRoutine = openaiClient.generateRoutine;
  analyseResume = openaiClient.analyseResume;
  mode = 'live';
} else {
  console.log('[AI] Sample Mode — set OPENAI_API_KEY in .env for live inference');
  generateRoutine = sampleMode.generateRoutine;
  analyseResume = sampleMode.analyseResume;
  mode = 'sample';
}

module.exports = { generateRoutine, analyseResume, mode };
