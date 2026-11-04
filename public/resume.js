/* resume.js — plain vanilla JS, no frameworks */
(function () {
  'use strict';

  /* ── Element refs ───────────────────────────────────────── */
  const routineSelect      = document.getElementById('routine-select');
  const samplePresets      = document.getElementById('sample-presets');
  const presetDeskBtn      = document.getElementById('preset-desk-btn');
  const presetUnclearBtn   = document.getElementById('preset-unclear-btn');
  const resumePhotoInput   = document.getElementById('resume-photo');
  const resumePhotoPreview = document.getElementById('resume-photo-preview');
  const analyseBtn         = document.getElementById('analyse-btn');
  const selectSection      = document.getElementById('select-section');
  const resultSection      = document.getElementById('result-section');
  const nextActionBox      = document.getElementById('next-action-box');
  const checklistItems     = document.getElementById('checklist-items');
  const checklistSummary   = document.getElementById('checklist-summary');
  const newSessionBtn      = document.getElementById('new-session-btn');
  const clearAllBtn        = document.getElementById('clear-all-btn');
  const statusDiv          = document.getElementById('resume-status');

  /* ── Pending preset ─────────────────────────────────────── */
  // Tracks which preset button was last clicked: null | 'charger-on-desk' | 'charger-unclear'
  var pendingPreset = null;

  /* ── Photo preview ──────────────────────────────────────── */
  resumePhotoInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) {
      resumePhotoPreview.hidden = true;
      resumePhotoPreview.src = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      resumePhotoPreview.src = e.target.result;
      resumePhotoPreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  /* ── Status helpers ─────────────────────────────────────── */
  function clearStatus() {
    statusDiv.innerHTML = '';
  }

  function showError(message, retryCallback) {
    clearStatus();
    var div = document.createElement('div');
    div.className = 'error-banner';

    var p = document.createElement('p');
    p.style.margin = '0 0 0.5rem';
    p.textContent = message;
    div.appendChild(p);

    if (retryCallback) {
      var retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-secondary';
      retryBtn.textContent = 'Retry';
      retryBtn.setAttribute('aria-label', 'Retry the analysis');
      retryBtn.addEventListener('click', function () {
        clearStatus();
        retryCallback();
      });
      div.appendChild(retryBtn);
    }

    statusDiv.appendChild(div);
  }

  function showSampleBanner() {
    // Remove existing sample banner if present before adding a new one
    var existing = statusDiv.querySelector('.sample-mode-banner');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.className = 'sample-mode-banner';
    div.setAttribute('role', 'note');

    var p = document.createElement('p');
    p.textContent =
      'Sample Mode — using fixture data. Add OPENAI_API_KEY to .env for live inference.';
    div.appendChild(p);

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'dismiss';
    dismiss.textContent = 'Dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss sample mode banner');
    dismiss.addEventListener('click', function () {
      div.remove();
    });
    div.appendChild(dismiss);

    statusDiv.insertBefore(div, statusDiv.firstChild);
  }

  function showConfirmation(message) {
    clearStatus();
    var div = document.createElement('div');
    div.style.cssText =
      'border:2px solid #1a7a3a;background:#e8f5ec;border-radius:4px;padding:1rem;margin-bottom:1rem;';
    var p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = message;
    div.appendChild(p);
    statusDiv.appendChild(div);
  }

  /* ── Badge helper ───────────────────────────────────────── */
  /**
   * Returns an element with the appropriate badge class and label.
   * Logic:
   *  - confirmed 'yes' OR observed 'in_bag' (no conflict, no 'no' confirmation) → .badge-packed
   *  - confirmed 'no' OR observed 'outside_bag' (no conflict, not confirmed 'yes') → .badge-missing
   *  - confirmed 'unsure' → .badge-unclear
   *  - conflict → .badge-unclear "⚠ Check again"
   *  - no observation, no confirmation → .badge-unknown
   */
  function makeBadge(item) {
    var badge = document.createElement('span');
    badge.className = 'badge';

    if (item.conflict) {
      badge.classList.add('badge-unclear');
      badge.textContent = '⚠ Check again';
      return badge;
    }

    if (item.confirmation === 'yes') {
      badge.classList.add('badge-packed');
      badge.textContent = '✓ Packed';
      return badge;
    }

    if (item.confirmation === 'no') {
      badge.classList.add('badge-missing');
      badge.textContent = '✗ Missing';
      return badge;
    }

    if (item.confirmation === 'unsure') {
      badge.classList.add('badge-unclear');
      badge.textContent = '? Unclear';
      return badge;
    }

    if (item.observedStatus === 'in_bag') {
      badge.classList.add('badge-packed');
      badge.textContent = '✓ Packed';
      return badge;
    }

    if (item.observedStatus === 'outside_bag') {
      badge.classList.add('badge-missing');
      badge.textContent = '✗ Missing';
      return badge;
    }

    // unclear observation or no data
    if (item.observedStatus === 'unclear') {
      badge.classList.add('badge-unclear');
      badge.textContent = '? Unclear';
      return badge;
    }

    badge.classList.add('badge-unknown');
    badge.textContent = '– Unknown';
    return badge;
  }

  /* ── Render checklist ───────────────────────────────────── */
  function renderChecklist(checklist) {
    checklistItems.innerHTML = '';

    var packed = checklist.filter(function (item) {
      return item.confirmation === 'yes' ||
        (!item.confirmation && item.observedStatus === 'in_bag' && !item.conflict);
    }).length;

    checklistSummary.textContent =
      'Checklist (' + packed + ' of ' + checklist.length + ' packed)';

    checklist.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'checklist-item';

      var numSpan = document.createElement('span');
      numSpan.className = 'step-num';
      numSpan.textContent = (idx + 1) + '.';
      row.appendChild(numSpan);

      var actionWrap = document.createElement('span');
      actionWrap.className = 'item-action';

      var actionText = document.createElement('span');
      actionText.textContent = item.action;
      actionWrap.appendChild(actionText);

      if (item.visualReason) {
        var reason = document.createElement('span');
        reason.className = 'item-reason';
        reason.textContent = item.visualReason;
        actionWrap.appendChild(reason);
      }

      row.appendChild(actionWrap);
      row.appendChild(makeBadge(item));

      checklistItems.appendChild(row);
    });
  }

  /* ── Render next action ─────────────────────────────────── */
  function renderNextAction(nextResult) {
    nextActionBox.innerHTML = '';

    if (nextResult.type === 'done') {
      var doneP = document.createElement('p');
      doneP.className = 'done-message';
      doneP.textContent = '🎉 ' + nextResult.message;
      nextActionBox.appendChild(doneP);
      return;
    }

    var msgP = document.createElement('p');
    msgP.className = 'next-action-text';
    msgP.textContent = nextResult.message;
    nextActionBox.appendChild(msgP);

    if (nextResult.type === 'question' || nextResult.type === 'conflict') {
      var btnsDiv = document.createElement('div');
      btnsDiv.className = 'confirm-buttons';

      var answers = [
        { label: 'Yes', value: 'yes' },
        { label: 'No',  value: 'no' },
        { label: "I'm not sure", value: 'unsure' }
      ];

      answers.forEach(function (ans) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary';
        btn.textContent = ans.label;
        btn.setAttribute('aria-label', ans.label);
        btn.addEventListener('click', function () {
          doConfirm(nextResult.stepId, ans.value);
        });
        btnsDiv.appendChild(btn);
      });

      nextActionBox.appendChild(btnsDiv);
    }
  }

  /* ── Render result section ──────────────────────────────── */
  function renderResult(data) {
    renderNextAction(data.nextResult);
    renderChecklist(data.checklist);
    resultSection.hidden = false;

    if (data.mode === 'sample') {
      showSampleBanner();
    }

    // Move focus to next-action box for screen readers
    nextActionBox.focus();
  }

  /* ── Ensure fixture routine is saved (for sample presets) ── */
  var fixtureSteps = [
    { id: 'step_1', action: 'Put the textbook in the bag' },
    { id: 'step_2', action: 'Put the notebook in the bag' },
    { id: 'step_3', action: 'Pack the laptop charger' },
    { id: 'step_4', action: 'Zip up the bag' }
  ];

  /**
   * Returns a Promise that resolves to a routineId string.
   * If the select already has a value, returns it directly.
   * Otherwise, auto-saves the fixture routine and populates the select.
   */
  function ensureRoutineId() {
    var existing = routineSelect.value;
    if (existing) {
      return Promise.resolve(existing);
    }

    return fetch('/api/routine/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sample Bag Routine', steps: fixtureSteps })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.data.error || 'Failed to save sample routine.');
        }
        var id = result.data.id;
        var name = result.data.name;
        // Add to select and select it
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        routineSelect.appendChild(opt);
        routineSelect.value = id;
        return id;
      });
  }

  /* ── Analyse flow ───────────────────────────────────────── */
  function doAnalyse(presetOverride) {
    clearStatus();

    var preset = presetOverride || pendingPreset || null;

    function runWithRoutineId(routineId) {
      var formData = new FormData();
      formData.append('routineId', routineId);

      var file = resumePhotoInput.files[0];
      if (file) {
        formData.append('photo', file);
      }

      if (preset) {
        formData.append('preset', preset);
      }

      analyseBtn.disabled = true;
      analyseBtn.textContent = 'Analysing…';
      presetDeskBtn.disabled = true;
      presetUnclearBtn.disabled = true;

      fetch('/api/session/resume', {
        method: 'POST',
        body: formData
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          analyseBtn.disabled = false;
          analyseBtn.textContent = 'Analyse';
          presetDeskBtn.disabled = false;
          presetUnclearBtn.disabled = false;
          pendingPreset = null;

          if (!result.ok) {
            var errMsg = (result.data && result.data.error)
              ? result.data.error
              : 'Server error (' + result.status + '). Please try again.';
            showError(errMsg, function () { doAnalyse(preset); });
            return;
          }

          renderResult(result.data);
          resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (err) {
          analyseBtn.disabled = false;
          analyseBtn.textContent = 'Analyse';
          presetDeskBtn.disabled = false;
          presetUnclearBtn.disabled = false;
          pendingPreset = null;
          showError('Network error: ' + err.message, function () { doAnalyse(preset); });
        });
    }

    if (preset) {
      // For presets, auto-save fixture routine if needed
      ensureRoutineId()
        .then(function (id) {
          runWithRoutineId(id);
        })
        .catch(function (err) {
          showError('Could not prepare sample routine: ' + err.message, null);
        });
    } else {
      var routineId = routineSelect.value;
      if (!routineId) {
        showError('Please select a routine.', null);
        routineSelect.focus();
        return;
      }
      runWithRoutineId(routineId);
    }
  }

  analyseBtn.addEventListener('click', function () {
    doAnalyse(null);
  });

  /* ── Preset buttons ─────────────────────────────────────── */
  presetDeskBtn.addEventListener('click', function () {
    pendingPreset = 'charger-on-desk';
    doAnalyse('charger-on-desk');
  });

  presetUnclearBtn.addEventListener('click', function () {
    pendingPreset = 'charger-unclear';
    doAnalyse('charger-unclear');
  });

  /* ── Confirm flow ───────────────────────────────────────── */
  function doConfirm(stepId, answer) {
    fetch('/api/session/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId: stepId, answer: answer })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          var msg = (result.data && result.data.error)
            ? result.data.error
            : 'Could not record confirmation (' + result.status + ').';
          showError(msg, null);
          return;
        }
        renderNextAction(result.data.nextResult);
        renderChecklist(result.data.checklist);
        if (result.data.mode === 'sample') {
          showSampleBanner();
        }
        // Move focus for screen readers
        nextActionBox.focus();
      })
      .catch(function (err) {
        showError('Network error: ' + err.message, null);
      });
  }

  /* ── Session controls ───────────────────────────────────── */
  newSessionBtn.addEventListener('click', function () {
    fetch('/api/session/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: false })
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        resultSection.hidden = true;
        nextActionBox.innerHTML = '';
        checklistItems.innerHTML = '';
        resumePhotoInput.value = '';
        resumePhotoPreview.hidden = true;
        resumePhotoPreview.src = '';
        clearStatus();
        selectSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        routineSelect.focus();
      })
      .catch(function (err) {
        showError('Network error: ' + err.message, null);
      });
  });

  clearAllBtn.addEventListener('click', function () {
    fetch('/api/session/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true })
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        resultSection.hidden = true;
        nextActionBox.innerHTML = '';
        checklistItems.innerHTML = '';
        resumePhotoInput.value = '';
        resumePhotoPreview.hidden = true;
        resumePhotoPreview.src = '';
        clearStatus();

        // Clear and repopulate the select
        while (routineSelect.options.length > 1) {
          routineSelect.remove(1);
        }
        routineSelect.value = '';

        populateRoutines();
        showConfirmation('All session data cleared.');
        selectSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (err) {
        showError('Network error: ' + err.message, null);
      });
  });

  /* ── Populate routines select ───────────────────────────── */
  function populateRoutines() {
    return fetch('/api/routines')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var routines = (data && data.routines) ? data.routines : [];

        // Remove all non-placeholder options
        while (routineSelect.options.length > 1) {
          routineSelect.remove(1);
        }

        routines.forEach(function (r) {
          var opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = r.name;
          routineSelect.appendChild(opt);
        });

        // Show sample presets when no routines are saved
        if (routines.length === 0) {
          samplePresets.hidden = false;
        } else {
          samplePresets.hidden = true;
        }

        return routines;
      })
      .catch(function () {
        // Non-fatal — show sample presets as fallback
        samplePresets.hidden = false;
        return [];
      });
  }

  /* ── Restore session on load ────────────────────────────── */
  function restoreSession() {
    return fetch('/api/session/state')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.nextResult && data.checklist) {
          renderResult(data);
        }
      })
      .catch(function () {
        // Non-fatal — start fresh
      });
  }

  /* ── Init ───────────────────────────────────────────────── */
  populateRoutines().then(function () {
    restoreSession();
  });

})();
