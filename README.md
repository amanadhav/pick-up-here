# Pick Up Here

AI-for-Good prototype for IBM Bobathon — helps people with memory or executive-function difficulties resume a familiar task after an interruption.

## Prerequisites

- Node.js ≥ 18
- npm

## Setup

```
git clone <repo>
cd pick-up-here
npm install
cp .env.example .env
```

Then open `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-...
```

If you don't have a key, leave it blank — the app runs in **Sample Mode** with fixture data.

## Start

```
npm start
```

Open **http://localhost:3000** in your browser.

To use a different port: `PORT=4000 npm start`

## Test

```
npm test
```

Runs 28 automated tests (state logic, response validation, route integration). No API key needed.

To test live inference (requires OPENAI_API_KEY):
```
node scripts/live-inference-test.js
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| OPENAI_API_KEY | No | GPT-4o API key. Leave unset for Sample Mode. |
| PORT | No | HTTP port (default: 3000). |
| SAMPLE_MODE | No | Set to `true` to force Sample Mode even if a key is set (useful for demos). |

## Project Structure

- `src/server.js` — Express entry point
- `src/routes/routine.js` — Teach flow API (generate, save, list)
- `src/routes/session.js` — Resume flow API (resume, confirm, clear, state)
- `src/logic/nextAction.js` — Pure next-action/question logic
- `src/ai/index.js` — AI layer factory (live vs sample)
- `src/ai/openai-client.js` — GPT-4o calls
- `src/ai/sample-mode.js` — Fixture responses
- `src/ai/schema.js` — Response shape validator
- `public/` — Static HTML/JS/CSS frontend (no build step)
- `tests/` — Vitest test suite
- `scripts/` — Evidence and inference scripts
- `evidence/` — Test output, live inference results

## 60-Second Demo

### Sample Mode (no API key needed)

**Teach a routine:**
1. Open http://localhost:3000/teach.html
2. Upload any four images into the four photo slots (or use the same image four times — sample mode ignores the content)
3. Optionally add a short note to one slot
4. Click **Generate Routine** — you will see the Sample Mode banner and four editable step cards
5. Edit the action text of Step 2 if you like
6. Enter a routine name (e.g. "School Bag") and click **Save Routine**
7. You will see "Routine saved! Go to Resume to use it."

**Resume with charger on desk:**
1. Open http://localhost:3000/resume.html
2. Click **Sample: Charger on desk** (this uses the saved routine automatically)
3. See the result: **"Pack the charger — it is on the desk to the right"** as the next action
4. The checklist shows Steps 1 and 2 as ✓ Packed, Step 3 as ✗ Missing

**Resume with charger out of view:**
1. Click **Start New Session**
2. Click **Sample: Charger out of view**
3. See the result: a question **"Can you see the laptop charger? Is it in the bag?"** with Yes / No / I'm not sure buttons

**Confirm answers:**
1. Click **No** → the next action updates to "Pack the charger — you said it is not in the bag yet."
2. Click **Start New Session**
3. Click **Sample: Charger out of view** again
4. Click **Yes** → the view advances to Step 4 ("Zip up the bag")
5. Click **I'm not sure** on a step → see a concrete check suggestion

**Start New Session:**
1. Click **Start New Session** — the checklist resets, the routine stays available
2. Click **Clear All Session Data** — everything clears

### Live Mode (with OPENAI_API_KEY)

Same steps as above, but:
- Upload real photos in Teach — the model will draft steps from what it sees
- Upload a real photo of your bag in progress in Resume — the model will observe which items are in or out

## Evidence

The `evidence/` directory contains:
- `test-run.txt` — Full output of the automated test suite
- `sample-mode-run.txt` — End-to-end sample mode flow output
- `live-inference-result.txt` — Live inference test result (NOT RUN if no key)
- `not-run.txt` — List of tests not run with reasons

## Privacy

Uploaded photos are held in server memory only for the duration of the session. They are never written to disk, sent to logs, or stored between server restarts. Clear them with **Clear All Session Data** or by restarting the server.
