// ── Topic Submission Form ─────────────────────────────────────────────────────

let clueTemplates = {};

// Fetch templates from server
fetch('/api/game/clue-templates')
  .then(r => r.json())
  .then(data => { clueTemplates = data; });

const categorySelect = document.getElementById('sub-category');
const topicInput     = document.getElementById('sub-topic');
const clueSection    = document.getElementById('clue-section');
const clueSlots      = document.getElementById('clue-slots');
const formError      = document.getElementById('form-error');
const submitBtn      = document.getElementById('submit-btn');

categorySelect.addEventListener('change', () => {
  const cat = categorySelect.value;
  if (!cat || !clueTemplates[cat]) {
    clueSection.classList.add('hidden');
    clueSlots.innerHTML = '';
    return;
  }
  renderClueSlots(cat);
  clueSection.classList.remove('hidden');
});

function renderClueSlots(category) {
  const templates = clueTemplates[category];
  clueSlots.innerHTML = '';
  templates.forEach((tmpl, i) => {
    const slot = document.createElement('div');
    slot.className = 'clue-slot';
    slot.innerHTML = `
      <div class="slot-header">
        <div class="slot-num">${i + 1}</div>
        <div class="slot-starter">${esc(tmpl.starter)}…</div>
        ${tmpl.required
          ? '<span class="req-mark">*</span>'
          : '<span class="opt-mark">(optional)</span>'}
      </div>
      <input
        type="text"
        class="clue-response-input"
        data-index="${i}"
        data-required="${tmpl.required}"
        placeholder="${tmpl.required ? 'Required' : 'Optional'}"
        autocorrect="off"
        autocapitalize="none"
        spellcheck="false"
        maxlength="200"
      >
    `;
    clueSlots.appendChild(slot);
  });
}

document.getElementById('submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const topic    = topicInput.value.trim();
  const category = categorySelect.value;
  const name     = document.getElementById('sub-name').value.trim();

  if (!topic)    { showError('Topic is required.'); return; }
  if (!category) { showError('Please select a category.'); return; }

  // Collect clue inputs
  const inputs = clueSlots.querySelectorAll('.clue-response-input');
  if (inputs.length === 0) { showError('Please select a category to fill in clues.'); return; }

  const clues = [];
  const topicLower = topic.toLowerCase();

  for (const input of inputs) {
    const idx      = parseInt(input.dataset.index, 10);
    const required = input.dataset.required === 'true';
    const response = input.value.trim();

    if (required && !response) {
      input.classList.add('error');
      showError(`Clue ${idx + 1} is required.`);
      input.focus();
      return;
    }
    input.classList.remove('error');

    if (response && response.toLowerCase().includes(topicLower)) {
      input.classList.add('error');
      showError(`Clue ${idx + 1} contains the topic word — keep it a secret!`);
      input.focus();
      return;
    }

    clues.push({ response });
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, category, submitted_by: name || 'anonymous', clues })
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Submission failed.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Topic';
      return;
    }

    // Show success
    document.getElementById('form-screen').classList.add('hidden');
    document.getElementById('success-screen').classList.remove('hidden');

  } catch (err) {
    showError('Network error — please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Topic';
  }
});

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
}
function clearError() {
  formError.classList.add('hidden');
}

function resetForm() {
  document.getElementById('submit-form').reset();
  clueSection.classList.add('hidden');
  clueSlots.innerHTML = '';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Topic';
  document.getElementById('form-screen').classList.remove('hidden');
  document.getElementById('success-screen').classList.add('hidden');
}

// Expose for inline onclick in HTML
window.resetForm = resetForm;

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
