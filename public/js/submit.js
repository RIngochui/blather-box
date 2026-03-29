// ── Topic Submission Form ─────────────────────────────────────────────────────

const topicInput  = document.getElementById('sub-topic');
const catSelect   = document.getElementById('sub-category');
const formError   = document.getElementById('form-error');
const submitBtn   = document.getElementById('submit-btn');

document.getElementById('submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const topic    = topicInput.value.trim();
  const category = catSelect.value;
  const name     = document.getElementById('sub-name').value.trim();
  const aliasRaw = document.getElementById('sub-aliases').value.trim();
  const aliases  = aliasRaw ? aliasRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!topic)    { showError('Topic is required.'); return; }
  if (!category) { showError('Please select a category.'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, category, submitted_by: name || 'anonymous', aliases })
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Submission failed.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Topic';
      return;
    }

    document.getElementById('form-screen').classList.add('hidden');
    document.getElementById('success-screen').classList.remove('hidden');

  } catch {
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
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Topic';
  document.getElementById('form-screen').classList.remove('hidden');
  document.getElementById('success-screen').classList.add('hidden');
}

window.resetForm = resetForm;
