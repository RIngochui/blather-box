// ── Admin Dashboard ───────────────────────────────────────────────────────────

let adminPassword = '';
let currentStatus = 'all';
let allTopics = [];
let selectedIds = new Set();
let clueTemplates = {};

// ── Auth ──────────────────────────────────────────────────────────────────────

const loginOverlay  = document.getElementById('login-overlay');
const loginPassword = document.getElementById('login-password');
const loginBtn      = document.getElementById('login-btn');
const loginError    = document.getElementById('login-error');

// Check sessionStorage for saved password
const saved = sessionStorage.getItem('bb_admin_pass');
if (saved) {
  adminPassword = saved;
  loginOverlay.classList.add('hidden');
  init();
}

loginBtn.addEventListener('click', attemptLogin);
loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });

async function attemptLogin() {
  const pw = loginPassword.value;
  if (!pw) return;
  loginBtn.disabled = true;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (res.ok) {
      adminPassword = pw;
      sessionStorage.setItem('bb_admin_pass', pw);
      loginOverlay.classList.add('hidden');
      init();
    } else {
      loginError.textContent = 'Wrong password.';
      loginError.classList.remove('hidden');
      loginBtn.disabled = false;
    }
  } catch {
    loginError.textContent = 'Network error.';
    loginError.classList.remove('hidden');
    loginBtn.disabled = false;
  }
}

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('bb_admin_pass');
  location.reload();
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Load clue templates
  const r = await fetch('/api/game/clue-templates');
  clueTemplates = await r.json();
  await loadStats();
  await loadTopics();
}

async function authFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-auth': adminPassword,
      ...(opts.headers || {})
    }
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  const res = await authFetch('/api/admin/stats');
  const s = await res.json();
  document.getElementById('stat-total').textContent    = s.total    || 0;
  document.getElementById('stat-pending').textContent  = s.pending  || 0;
  document.getElementById('stat-approved').textContent = s.approved || 0;
  document.getElementById('stat-rejected').textContent = s.rejected || 0;
}

// ── Topics ────────────────────────────────────────────────────────────────────

async function loadTopics() {
  const url = currentStatus === 'all'
    ? '/api/admin/topics'
    : `/api/admin/topics?status=${currentStatus}`;
  const res = await authFetch(url);
  allTopics = await res.json();
  selectedIds.clear();
  renderTable();
  updateBulkUI();
}

function renderTable() {
  const tbody = document.getElementById('topics-tbody');
  if (!allTopics.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem;">No topics found.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  allTopics.forEach(topic => {
    const tr = document.createElement('tr');
    tr.dataset.id = topic.id;

    const clues = typeof topic.clues === 'string' ? JSON.parse(topic.clues) : topic.clues;
    const clueHtml = clues
      .filter(c => c.response && c.response.trim())
      .map(c => `<span class="clue-line"><span class="clue-starter">${esc(c.starter)}… </span><span class="clue-response">${esc(c.response)}</span></span>`)
      .join('');

    const date = new Date(topic.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${topic.id}" ${selectedIds.has(topic.id) ? 'checked' : ''}></td>
      <td class="topic-name">${esc(topic.topic)}</td>
      <td>${esc(topic.category)}</td>
      <td class="clues-col"><div class="clue-assembled">${clueHtml}</div></td>
      <td><div class="topic-meta">${esc(topic.submitted_by)}</div></td>
      <td><div class="topic-meta">${date}</div></td>
      <td><span class="badge badge-${topic.status}">${topic.status}</span></td>
      <td class="actions-cell">
        ${topic.status !== 'approved' ? `<button class="btn btn-green btn-sm" data-action="approve" data-id="${topic.id}">✓</button>` : ''}
        ${topic.status !== 'rejected' ? `<button class="btn btn-red btn-sm" data-action="reject" data-id="${topic.id}">✗</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${topic.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${topic.id}" style="color:var(--red)">Del</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind row checkboxes
  tbody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.id);
      if (cb.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateBulkUI();
    });
  });

  // Bind action buttons
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.id)));
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function handleAction(action, id) {
  if (action === 'approve') {
    await authFetch(`/api/admin/topics/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' })
    });
    showToast('Approved', 'success');
    await refresh();

  } else if (action === 'reject') {
    await authFetch(`/api/admin/topics/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' })
    });
    showToast('Rejected', 'error');
    await refresh();

  } else if (action === 'delete') {
    if (!confirm('Delete this topic? This cannot be undone.')) return;
    await authFetch(`/api/admin/topics/${id}`, { method: 'DELETE' });
    showToast('Deleted');
    await refresh();

  } else if (action === 'edit') {
    openInlineEdit(id);
  }
}

function openInlineEdit(id) {
  // Close any existing edit rows
  document.querySelectorAll('.edit-row').forEach(r => r.remove());
  document.querySelectorAll('tr.editing').forEach(r => r.classList.remove('editing'));

  const topic = allTopics.find(t => t.id === id);
  if (!topic) return;
  const clues = typeof topic.clues === 'string' ? JSON.parse(topic.clues) : topic.clues;

  const sourceRow = document.querySelector(`tr[data-id="${id}"]`);
  if (!sourceRow) return;
  sourceRow.classList.add('editing');

  const editRow = document.createElement('tr');
  editRow.className = 'edit-row';

  // Build clue fields
  const clueFields = clues.map((c, i) => `
    <div class="edit-clue-field">
      <span class="starter-label">${esc(c.starter)}…</span>
      <input type="text" class="edit-clue-response" data-clue-index="${i}"
        value="${esc(c.response)}" placeholder="${c.required ? 'Required' : 'Optional'}"
        autocorrect="off" autocapitalize="none" spellcheck="false">
    </div>
  `).join('');

  editRow.innerHTML = `
    <td colspan="8">
      <div class="inline-edit-form">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.8rem;color:var(--muted);">Topic</label>
            <input type="text" id="edit-topic-input" value="${esc(topic.topic)}" autocorrect="off" autocapitalize="words">
          </div>
          <div style="min-width:160px;">
            <label style="font-size:0.8rem;color:var(--muted);">Category</label>
            <select id="edit-category-select">
              ${['Thing','Person','Place','Food/Drink','Activity','Movie/Show']
                .map(c => `<option ${c === topic.category ? 'selected' : ''}>${c}</option>`)
                .join('')}
            </select>
          </div>
        </div>
        <div id="edit-clue-fields">${clueFields}</div>
        <div class="edit-actions">
          <button class="btn btn-primary btn-sm" id="save-edit-btn">Save</button>
          <button class="btn btn-ghost btn-sm" id="cancel-edit-btn">Cancel</button>
        </div>
      </div>
    </td>
  `;

  sourceRow.insertAdjacentElement('afterend', editRow);

  document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editRow.remove();
    sourceRow.classList.remove('editing');
  });

  document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const newTopic    = document.getElementById('edit-topic-input').value.trim();
    const newCategory = document.getElementById('edit-category-select').value;
    const newClueInputs = editRow.querySelectorAll('.edit-clue-response');
    const newClues = clues.map((c, i) => ({
      ...c,
      response: newClueInputs[i] ? newClueInputs[i].value.trim() : c.response
    }));

    if (!newTopic) { alert('Topic cannot be empty.'); return; }

    await authFetch(`/api/admin/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ topic: newTopic, category: newCategory, clues: newClues })
    });
    showToast('Saved', 'success');
    await refresh();
  });
}

// ── Bulk actions ──────────────────────────────────────────────────────────────

document.getElementById('bulk-approve-btn').addEventListener('click', async () => {
  if (!selectedIds.size) return;
  await authFetch('/api/admin/topics/bulk-status', {
    method: 'PATCH',
    body: JSON.stringify({ ids: [...selectedIds], status: 'approved' })
  });
  showToast(`Approved ${selectedIds.size}`, 'success');
  await refresh();
});

document.getElementById('bulk-reject-btn').addEventListener('click', async () => {
  if (!selectedIds.size) return;
  await authFetch('/api/admin/topics/bulk-status', {
    method: 'PATCH',
    body: JSON.stringify({ ids: [...selectedIds], status: 'rejected' })
  });
  showToast(`Rejected ${selectedIds.size}`, 'error');
  await refresh();
});

document.getElementById('select-all-btn').addEventListener('click', () => {
  const checks = document.querySelectorAll('.row-check');
  const allChecked = [...checks].every(c => c.checked);
  checks.forEach(c => {
    c.checked = !allChecked;
    const id = parseInt(c.dataset.id);
    if (!allChecked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
  updateBulkUI();
});

document.getElementById('header-check').addEventListener('change', (e) => {
  const checks = document.querySelectorAll('.row-check');
  checks.forEach(c => {
    c.checked = e.target.checked;
    const id = parseInt(c.dataset.id);
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
  updateBulkUI();
});

function updateBulkUI() {
  document.getElementById('bulk-count').textContent = selectedIds.size;
  document.getElementById('bulk-approve-btn').disabled = selectedIds.size === 0;
  document.getElementById('bulk-reject-btn').disabled  = selectedIds.size === 0;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.getElementById('tab-row').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatus = btn.dataset.status;
  loadTopics();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function refresh() {
  await loadStats();
  await loadTopics();
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ` ${type}` : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
