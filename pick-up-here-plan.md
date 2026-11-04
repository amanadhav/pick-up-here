# Pick Up Here — Implementation Plan

## Top-Level Overview

**Goal:** Build a working AI-for-Good prototype called *Pick Up Here* for IBM Bobathon.
It helps people with memory or executive-function difficulties resume a familiar task
(initially: packing a school bag) after an interruption.

**Approach:**
- Small Node/Express backend + plain HTML/JS frontend, one startup command (`npm start`).
- Vision provider: **OpenAI GPT-4o** via `OPENAI_API_KEY`. If the key is absent the app
  runs in clearly-labelled **Sample Mode** using fixture JSON responses with identical
  shape to live responses.
- All uploaded photos and session state live only in the server's active memory (cleared
  on restart or via Clear All Session Data). No image contents are logged.
- Automated tests cover state management and response validation; browser smoke tests
  cover the core flow; live-inference tests (if key present) capture actual model output.
- Everything is saved under `evidence/` as required.

**Confirmed design decisions:**
1. No build step — Express + plain HTML + vanilla JS; `npm start` / `npm test` only.
2. In-memory session state in `app.locals` keyed by per-browser session ID. Saved
   routines and resume progress are stored separately.
   - **Start New Session** clears progress and the last resume photo; keeps the routine.
   - **Clear All Session Data** removes the routine, teaching photos, and progress.
   - Photos stay in memory only; never written to disk or logged.
3. Conflict detection: if a new model observation contradicts a prior user confirmation,
   show one question before changing status. The user may keep their answer, correct it,
   or say "I'm not sure". A photo that simply does not show the item is treated as
   `unknown` and keeps the prior confirmation.
4. Sample Mode bundles a Teach example and two Resume presets ("Charger on desk" and
   "Charger out of view"). Live Mode shows a retryable error if inference fails.

**Non-goals (out of scope for this prototype):**
- Persistence across server restarts
- Routines other than bag packing
- User accounts or multi-user support
- Visual polish beyond accessibility baseline

---

## Architecture Sketch

```
Browser (HTML/JS)
  ├─ /teach   — upload 4 photos + notes, view/edit generated steps, save routine
  └─ /resume  — select routine, upload fresh photo, show next action + checklist

Express Server
  ├─ POST /api/routine/generate   — calls GPT-4o with 4 teaching photos
  ├─ POST /api/routine/save       — stores approved routine in session
  ├─ GET  /api/routines           — lists saved routines
  ├─ POST /api/session/resume     — calls GPT-4o with routine + fresh photo + confirmations
  ├─ POST /api/session/confirm    — records a user confirmation, returns next action
  └─ POST /api/session/clear      — wipes active session state

AI Layer (server-side only)
  ├─ openai-client.js             — wraps GPT-4o calls, validates response shape
  └─ sample-mode.js               — fixture responses, same shape as live
```

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold

**Status:** `[ ] pending`

**Intent:**
Create the directory structure, `package.json`, `.env.example`, `.gitignore`,
and the minimal Express server so every later sub-task has a working base to
build on.

**Expected Outcomes:**
- `npm install` succeeds.
- `npm start` starts a server and responds to `GET /` with a 200.
- `.env.example` documents `OPENAI_API_KEY` and `PORT`.
- `.gitignore` excludes `.env`, `node_modules/`, and `uploads/`.
- A `SAMPLE_MODE=true` fallback is documented in `.env.example`.

**Todo List:**
1. Create `package.json` with `express`, `multer`, `openai`, `dotenv` as dependencies
   and `vitest` + `supertest` as dev dependencies.
2. Create `src/server.js` — Express entry point, reads `.env`, mounts routers,
   serves `public/` as static files.
3. Create `src/routes/` directory stub with placeholder files for `routine.js`
   and `session.js`.
4. Create `public/index.html` — minimal shell with links to Teach and Resume pages.
5. Create `.env.example`, `.gitignore`, and `README.md` with startup instructions.
6. Verify `npm start` returns HTTP 200 on `/`.

**Relevant Context:**
- Single command: `npm start` (maps to `node src/server.js`).
- Port default: 3000, overridable via `PORT` env var.

---

### Sub-Task 2 — AI Layer: OpenAI Client + Sample Mode

**Status:** `[ ] pending`

**Intent:**
Encapsulate all model calls in one module so the rest of the app never
touches the OpenAI SDK directly. Implement Sample Mode as an identical
interface so the app works without a key.

**Expected Outcomes:**
- `src/ai/openai-client.js` exports `generateRoutine(photos, notes)` and
  `analyseResume(routine, freshPhoto, confirmations)`.
- `src/ai/sample-mode.js` exports the same two functions with fixture data.
- A factory `src/ai/index.js` picks real vs sample based on `OPENAI_API_KEY`
  presence and logs which mode is active at startup.
- Both `generateRoutine` and `analyseResume` validate the model response against
  a schema and throw a structured error if it does not match.
- Fixtures live in `src/ai/fixtures/` as plain JSON files.

**Expected JSON shapes:**

*generateRoutine response:*
```json
{
  "steps": [
    { "id": "step_1", "action": "Put the textbook in the bag", "photoRef": 0 }
  ]
}
```

*analyseResume response:*
```json
{
  "observations": [
    {
      "stepId": "step_1",
      "status": "in_bag | outside_bag | unclear",
      "visualReason": "The textbook spine is visible inside the open bag"
    }
  ],
  "nextQuestion": null,
  "nextAction": "Pack the charger — it is on the desk to the right"
}
```

**Todo List:**
1. Create `src/ai/fixtures/generate-routine.json` — a plausible 4-step bag routine.
2. Create `src/ai/fixtures/analyse-resume.json` — two variants:
   charger-on-desk (suggests packing) and charger-unclear (asks a question).
3. Create `src/ai/schema.js` — JSON schema / validator for both response shapes.
4. Create `src/ai/sample-mode.js` — returns fixtures, validates shape.
5. Create `src/ai/openai-client.js` — builds GPT-4o prompt with base64-encoded
   images, parses and validates response, re-throws structured error on failure.
6. Create `src/ai/index.js` — factory; logs `[AI] Sample Mode` or `[AI] Live: GPT-4o`.
7. Write unit tests in `tests/ai/` covering: valid response passes validation,
   invalid JSON throws structured error, wrong step IDs throw structured error.

**Relevant Context:**
- GPT-4o supports multiple image inputs in a single message.
- Base64-encode images server-side; never send image data to the client.
- Prompt must instruct the model to return **only** JSON with no markdown fences.

---

### Sub-Task 3 — Teach Flow (Backend)

**Status:** `[ ] pending`

**Intent:**
Implement the server routes that accept four teaching photos with optional notes,
call the AI layer to draft a routine, and save the approved routine to session.

**Expected Outcomes:**
- `POST /api/routine/generate` accepts a `multipart/form-data` body with
  `photo_0`…`photo_3` files and `note_0`…`note_3` text fields; returns
  `{ steps: [...] }`.
- `POST /api/routine/save` accepts `{ name, steps }` and stores it; returns
  `{ id }`.
- `GET /api/routines` returns the list of saved routines (name + id only).
- File uploads are held in memory (no disk writes); cleared on session reset.
- Errors from the AI layer are caught and returned as `{ error, retryable: true }`.

**Todo List:**
1. Implement `src/routes/routine.js` with the three endpoints above.
2. Configure `multer` with memory storage and 4-file limit.
3. Wire the router into `src/server.js`.
4. Write integration tests in `tests/routes/routine.test.js` using supertest and
   the sample-mode AI (no real key needed); test happy path, missing photos, and
   AI error recovery.

**Relevant Context:**
- Routine saved to `req.app.locals.routines` (Map keyed by UUID).
- Step IDs are assigned by the AI layer; validate they are unique strings.

---

### Sub-Task 4 — Resume Flow (Backend)

**Status:** `[ ] pending`

**Intent:**
Implement the server routes that handle a resume session: accept a fresh photo
plus the selected routine, call the AI, merge observations with user confirmations,
and compute the next action or question.

**Expected Outcomes:**
- `POST /api/session/resume` accepts `{ routineId }` + `photo` file; returns a
  `ResumeResult` with `observations`, `checklist`, `nextAction`, `nextQuestion`,
  and `mode` (`"sample"` or `"live"`).
- `POST /api/session/confirm` accepts `{ stepId, answer }` where answer is
  `"yes" | "no" | "unsure"`; returns an updated `ResumeResult`.
- `POST /api/session/clear` wipes `req.app.locals.session` and returns `{ ok: true }`.
- User confirmations override model observations; a new conflicting observation
  triggers a resolve prompt rather than silently overwriting.
- Each new `resume` call starts with fresh observations (but retains confirmations
  until `clear` is called).

**State shape in `req.app.locals.session`:**
```json
{
  "routineId": "...",
  "observations": { "step_1": { "status": "...", "visualReason": "..." } },
  "confirmations": { "step_1": "yes" },
  "conflicts": ["step_1"]
}
```

**Next-action logic (stateless function, easy to unit-test):**
1. Walk steps in order.
2. Skip steps confirmed `"yes"`.
3. For the first step not confirmed `"yes"`:
   - If `outside_bag` → return action to pack it.
   - If `unclear` or no observation → return question about it.
   - If confirmed `"no"` → return action to pack it.
   - If confirmed `"unsure"` → return a concrete "check" suggestion.
4. If all steps resolved → return a "all done" message.

**Todo List:**
1. Implement `src/logic/nextAction.js` — pure function, no I/O.
2. Write unit tests in `tests/logic/nextAction.test.js` covering all branches
   from the verification criteria (charger visible, charger unclear, answers Yes/No/unsure,
   all done).
3. Implement `src/routes/session.js` with the three endpoints.
4. Wire the router into `src/server.js`.
5. Write integration tests in `tests/routes/session.test.js` covering: resume
   with sample fixture, confirm yes → moves to next step, confirm no → pack action,
   clear → fresh state.

**Relevant Context:**
- The `nextAction` function receives `{ steps, observations, confirmations, conflicts }`.
- Conflicts are detected by comparing a new observation to an existing confirmation.

---

### Sub-Task 5 — Frontend: Teach Page

**Status:** `[ ] pending`

**Intent:**
Build the Teach page as a single HTML file with inline or linked JS/CSS.
No build step — plain fetch API calls to the backend.

**Expected Outcomes:**
- `public/teach.html` renders four numbered photo upload slots with optional note
  fields.
- Clicking **Generate Routine** calls `POST /api/routine/generate` and shows
  four editable step cards (action text editable in-place).
- Clicking **Save Routine** calls `POST /api/routine/save` with the edited steps
  and a routine name.
- Success state shows a confirmation and a link to the Resume page.
- Error state shows the error message and a **Retry** button.
- Page is keyboard accessible (tab order, visible focus ring) and high-contrast.
- Large controls (min 44 × 44 px tap targets) and text labels on all status icons.

**Todo List:**
1. Create `public/teach.html` with semantic HTML (fieldsets, labels, buttons).
2. Add `public/teach.js` — handles form submission, renders step cards, handles
   save and error states.
3. Add `public/style.css` — high-contrast theme, large controls, phone-friendly
   layout (max-width 600 px, fluid).
4. Link both pages from `public/index.html`.
5. Manual check: tab through the page, confirm all controls are reachable.

**Relevant Context:**
- No framework — plain DOM APIs.
- Photo preview (small thumbnail) aids orientation but is not required for MVP.

---

### Sub-Task 6 — Frontend: Resume Page

**Status:** `[ ] pending`

**Intent:**
Build the Resume page so the user can select a saved routine, upload a fresh photo,
and see the next action with a supporting checklist. Confirmations update the view
without a full page reload.

**Expected Outcomes:**
- `public/resume.html` shows a routine selector (populated from `GET /api/routines`),
  a photo upload control, and an **Analyse** button.
- After analysis, a **prominent next action** (or one short question with Yes/No/Unsure
  buttons) is shown at the top.
- Below, a compact checklist shows each step with its status badge and visual reason.
- Answering Yes/No/Unsure calls `POST /api/session/confirm` and re-renders the
  next action (no full reload).
- **Start New Session** calls `POST /api/session/clear` and resets the view.
- **Sample Mode** banner is shown when `mode === "sample"` in the response.
- Same accessibility requirements as the Teach page.

**Todo List:**
1. Create `public/resume.html` with semantic structure.
2. Add `public/resume.js` — handles routine selection, photo upload, analysis,
   confirmation flow, and session clear.
3. Reuse `public/style.css`; add checklist and next-action component styles.
4. Manual check: full end-to-end flow in browser (Teach → Save → Resume → Confirm).

**Relevant Context:**
- Status badges: ✅ Packed (confirmed yes), ❌ Missing (confirmed no / outside_bag),
  ❓ Unclear (unclear / unsure), ⬜ Unknown (no observation, no confirmation).
- `nextQuestion` takes priority over `nextAction` in the UI if both are present.

---

### Sub-Task 7 — Automated Tests + Evidence

**Status:** `[ ] pending`

**Intent:**
Run all automated tests, optionally run live-inference tests if a key is configured,
and save all results to `evidence/`.

**Expected Outcomes:**
- `npm test` runs the full test suite and exits 0.
- `evidence/test-run.txt` contains the test output.
- If `OPENAI_API_KEY` is set: `evidence/live-inference-1.json` and
  `evidence/live-inference-2.json` contain the raw model responses for two
  different resume photos.
- `evidence/sample-mode-run.txt` documents a sample-mode run confirming the
  end-to-end flow produces valid output without a key.
- Any test that could not be run is noted in `evidence/not-run.txt` with the
  reason.

**Todo List:**
1. Add `npm test` script (vitest with coverage) to `package.json`.
2. Run `npm test` and capture output to `evidence/test-run.txt`.
3. Write `scripts/live-inference-test.js` — sends two fixture photos to the real
   model, saves raw responses to `evidence/`.
4. Run the script if `OPENAI_API_KEY` is available; document outcome.
5. Capture a sample-mode end-to-end run and save to `evidence/sample-mode-run.txt`.
6. Fill `evidence/not-run.txt` for anything skipped.

---

### Sub-Task 8 — Demo Script + README

**Status:** `[ ] pending`

**Intent:**
Write the final startup instructions and a concise 60-second demo script so the
Bobathon judges can run the prototype immediately.

**Expected Outcomes:**
- `README.md` contains:
  1. Prerequisites (Node ≥ 18).
  2. `npm install` and `cp .env.example .env` steps.
  3. Where to paste the `OPENAI_API_KEY` (or how to run in Sample Mode).
  4. `npm start` startup command.
  5. The URL to open.
- A **60-second demo script** section in `README.md` with exact clicks:
  1. Open `/teach` → upload 4 photos → click Generate → edit step 2 text →
     click Save.
  2. Open `/resume` → select the routine → upload a photo with charger on
     desk → click Analyse → observe "Pack the charger" as the next action.
  3. Click Start New Session → confirm the checklist resets.
- `evidence/` directory is listed in README.

**Todo List:**
1. Update `README.md` with all sections above.
2. Verify startup command end-to-end on a clean `npm install`.
3. Confirm Sample Mode banner appears when key is absent.
