// ── Admin Dashboard ───────────────────────────────────────────────────────────

let adminPassword = '';
let currentStatus = 'all';
let allTopics = [];
let selectedIds = new Set();

// ── Auth ──────────────────────────────────────────────────────────────────────

const loginOverlay  = document.getElementById('login-overlay');
const loginPassword = document.getElementById('login-password');
const loginBtn      = document.getElementById('login-btn');
const loginError    = document.getElementById('login-error');

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

function parseAliases(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
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
    const date = new Date(topic.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    const aliases = parseAliases(topic.aliases);
    const aliasText = aliases.length ? aliases.join(', ') : '—';

    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${topic.id}" ${selectedIds.has(topic.id) ? 'checked' : ''}></td>
      <td class="topic-name">${esc(topic.topic)}</td>
      <td>${esc(topic.category)}</td>
      <td style="color:var(--muted);font-size:0.85rem;">${esc(aliasText)}</td>
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

  tbody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.id);
      if (cb.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateBulkUI();
    });
  });

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
  document.querySelectorAll('.edit-row').forEach(r => r.remove());
  document.querySelectorAll('tr.editing').forEach(r => r.classList.remove('editing'));

  const topic = allTopics.find(t => t.id === id);
  if (!topic) return;

  const sourceRow = document.querySelector(`tr[data-id="${id}"]`);
  if (!sourceRow) return;
  sourceRow.classList.add('editing');

  const editRow = document.createElement('tr');
  editRow.className = 'edit-row';
  const currentAliases = parseAliases(topic.aliases);
  editRow.innerHTML = `
    <td colspan="8">
      <div class="inline-edit-form">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;">
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
        <div style="margin-top:0.75rem;">
          <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:0.4rem;">
            Alternate Names — guessers can type any of these to win
          </label>
          <div class="alias-tag-editor" id="alias-tag-editor"></div>
        </div>
        <div class="edit-actions">
          <button class="btn btn-primary btn-sm" id="save-edit-btn">Save</button>
          <button class="btn btn-ghost btn-sm" id="cancel-edit-btn">Cancel</button>
        </div>
      </div>
    </td>
  `;

  sourceRow.insertAdjacentElement('afterend', editRow);

  // ── Alias tag editor ──────────────────────────────────────────────────────
  const tagEditor = editRow.querySelector('#alias-tag-editor');
  let editAliases = [...currentAliases];

  function renderTagEditor() {
    tagEditor.innerHTML = '';
    editAliases.forEach((alias, i) => {
      const tag = document.createElement('span');
      tag.className = 'alias-tag';
      tag.innerHTML = `${esc(alias)}<button class="alias-tag-remove" data-i="${i}" title="Remove">×</button>`;
      tagEditor.appendChild(tag);
    });
    // Add input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'alias-tag-input';
    input.placeholder = 'Type alias, press Enter…';
    input.autocorrect = 'off';
    input.autocapitalize = 'words';
    input.spellcheck = false;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/,$/, '');
        if (val && !editAliases.map(a => a.toLowerCase()).includes(val.toLowerCase())) {
          editAliases.push(val);
          renderTagEditor();
        } else {
          input.value = '';
        }
      } else if (e.key === 'Backspace' && input.value === '' && editAliases.length) {
        editAliases.pop();
        renderTagEditor();
      }
    });
    tagEditor.appendChild(input);

    // Remove buttons
    tagEditor.querySelectorAll('.alias-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        editAliases.splice(parseInt(btn.dataset.i), 1);
        renderTagEditor();
      });
    });

    // Click anywhere in the editor to focus input
    tagEditor.addEventListener('click', () => input.focus());
  }

  renderTagEditor();

  // ── Save / Cancel ─────────────────────────────────────────────────────────
  editRow.querySelector('#cancel-edit-btn').addEventListener('click', () => {
    editRow.remove();
    sourceRow.classList.remove('editing');
  });

  editRow.querySelector('#save-edit-btn').addEventListener('click', async () => {
    const newTopic    = editRow.querySelector('#edit-topic-input').value.trim();
    const newCategory = editRow.querySelector('#edit-category-select').value;
    // Also grab anything partially typed in the alias input
    const partialInput = tagEditor.querySelector('.alias-tag-input');
    if (partialInput && partialInput.value.trim()) {
      const val = partialInput.value.trim();
      if (!editAliases.map(a => a.toLowerCase()).includes(val.toLowerCase())) {
        editAliases.push(val);
      }
    }
    if (!newTopic) { alert('Topic cannot be empty.'); return; }

    await authFetch(`/api/admin/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ topic: newTopic, category: newCategory, aliases: editAliases })
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
