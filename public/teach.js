/* teach.js — plain vanilla JS, no frameworks */
(function () {
  'use strict';

  /* ── Element refs ───────────────────────────────────────── */
  const form          = document.getElementById('teach-form');
  const generateBtn   = document.getElementById('generate-btn');
  const routinePreview = document.getElementById('routine-preview');
  const reviewTitle   = document.getElementById('review-title');
  const stepCardsEl   = document.getElementById('step-cards');
  const routineNameEl = document.getElementById('routine-name');
  const saveBtn       = document.getElementById('save-btn');
  const statusMsg     = document.getElementById('status-msg');
  let generatedSteps = [];

  /* ── Photo preview ──────────────────────────────────────── */
  for (let i = 0; i < 4; i++) {
    const fileInput = document.getElementById('photo_' + i);
    const preview   = document.getElementById('preview_' + i);

    fileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) {
        preview.hidden = true;
        preview.src = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.hidden = false;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Helpers ────────────────────────────────────────────── */
  function clearStatus() {
    statusMsg.innerHTML = '';
  }

  function showError(message, showRetry) {
    clearStatus();
    const div = document.createElement('div');
    div.className = 'error-banner';

    const p = document.createElement('p');
    p.textContent = message;
    div.appendChild(p);

    if (showRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-secondary';
      retryBtn.textContent = 'Retry';
      retryBtn.setAttribute('aria-label', 'Retry generating the routine');
      retryBtn.addEventListener('click', function () {
        clearStatus();
        enableForm();
      });
      div.appendChild(retryBtn);
    }

    statusMsg.appendChild(div);
  }

  function showSampleBanner() {
    clearStatus();
    const div = document.createElement('div');
    div.className = 'sample-mode-banner';
    div.setAttribute('role', 'note');

    const p = document.createElement('p');
    p.textContent =
      'Sample Mode · These steps come from a prepared example.';
    div.appendChild(p);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'dismiss';
    dismiss.textContent = 'Dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss sample mode banner');
    dismiss.addEventListener('click', function () {
      div.remove();
    });
    div.appendChild(dismiss);

    statusMsg.appendChild(div);
  }

  function setGenerating(isGenerating) {
    generateBtn.disabled = isGenerating;
    generateBtn.textContent = isGenerating ? 'Generating…' : 'Generate Routine';
  }

  function disableForm() {
    setGenerating(true);
    for (let i = 0; i < 4; i++) {
      const fi = document.getElementById('photo_' + i);
      const ni = document.getElementById('note_'  + i);
      if (fi) fi.disabled = true;
      if (ni) ni.disabled = true;
    }
  }

  function enableForm() {
    setGenerating(false);
    for (let i = 0; i < 4; i++) {
      const fi = document.getElementById('photo_' + i);
      const ni = document.getElementById('note_'  + i);
      if (fi) fi.disabled = false;
      if (ni) ni.disabled = false;
    }
  }

  /* ── Render step cards ──────────────────────────────────── */
  function renderStepCards(steps) {
    generatedSteps = steps;
    stepCardsEl.innerHTML = '';

    steps.forEach(function (step, idx) {
      const card = document.createElement('div');
      card.className = 'step-card';

      const numLabel = document.createElement('div');
      numLabel.className = 'step-number';
      numLabel.textContent = 'Step ' + (idx + 1);
      card.appendChild(numLabel);

      const inputLabel = document.createElement('label');
      const inputId = 'step-action-' + idx;
      inputLabel.setAttribute('for', inputId);
      inputLabel.textContent = 'Action text';
      card.appendChild(inputLabel);

      const actionInput = document.createElement('input');
      actionInput.type = 'text';
      actionInput.id = inputId;
      actionInput.name = 'step_action_' + idx;
      actionInput.value = step.action || '';
      card.appendChild(actionInput);

      stepCardsEl.appendChild(card);
    });
  }

  /* ── Collect edited steps from cards ───────────────────── */
  function collectEditedSteps() {
    const inputs = stepCardsEl.querySelectorAll('input[type="text"]');
    return Array.from(inputs).map(function (input, index) {
      return { ...generatedSteps[index], action: input.value.trim() };
    });
  }

  /* ── Generate form submit ───────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearStatus();

    const formData = new FormData();
    for (let i = 0; i < 4; i++) {
      const fileInput = document.getElementById('photo_' + i);
      const noteInput = document.getElementById('note_'  + i);
      if (fileInput.files[0]) {
        formData.append('photo_' + i, fileInput.files[0]);
      }
      formData.append('note_' + i, noteInput.value || '');
    }

    disableForm();
    routinePreview.hidden = true;

    fetch('/api/routine/generate', {
      method: 'POST',
      body: formData
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        enableForm();

        if (!result.ok) {
          const msg = (result.data && result.data.error)
            ? result.data.error
            : 'Server error (' + result.status + '). Please try again.';
          showError(msg, true);
          return;
        }

        const steps = result.data.steps;
        const mode  = result.data.mode;

        renderStepCards(steps);
        routinePreview.hidden = false;
        reviewTitle.focus();
        routinePreview.scrollIntoView({ block: 'start' });
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Routine';

        if (mode === 'sample') {
          showSampleBanner();
        }
      })
      .catch(function (err) {
        enableForm();
        showError('Network error: ' + err.message, true);
      });
  });

  /* ── Save button ────────────────────────────────────────── */
  saveBtn.addEventListener('click', function () {
    clearStatus();

    const name = routineNameEl.value.trim();
    if (!name) {
      routineNameEl.focus();
      showError('Please enter a routine name before saving.', false);
      return;
    }

    const steps = collectEditedSteps();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    fetch('/api/routine/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, steps: steps })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Routine';

        if (!result.ok) {
          const msg = (result.data && result.data.error)
            ? result.data.error
            : 'Save failed (' + result.status + '). Please try again.';
          showError(msg, false);
          return;
        }

        // Success
        clearStatus();
        const successDiv = document.createElement('div');
        successDiv.className = 'success-banner';

        const successP = document.createElement('p');
        successP.textContent = 'Routine saved! Go to Resume to use it.';
        successDiv.appendChild(successP);

        const resumeLink = document.createElement('a');
        resumeLink.href = 'resume.html';
        resumeLink.textContent = 'Go to Resume a Task →';
        successDiv.appendChild(resumeLink);

        statusMsg.appendChild(successDiv);
        resumeLink.focus();
        statusMsg.scrollIntoView({ block: 'start' });

        // Disable save button to prevent double-save
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saved';
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Routine';
        showError('Network error: ' + err.message, false);
      });
  });

})();
