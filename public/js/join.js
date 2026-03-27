// ── Join screen ───────────────────────────────────────────────────────────────

const socket = io();

const codeInput  = document.getElementById('room-code-input');
const nameInput  = document.getElementById('player-name-input');
const joinBtn    = document.getElementById('join-btn');
const joinError  = document.getElementById('join-error');

// Pre-fill code from URL query ?code=ABCD
const params = new URLSearchParams(location.search);
if (params.get('code')) codeInput.value = params.get('code').toUpperCase();

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
});

function showError(msg) {
  joinError.textContent = msg;
  joinError.classList.remove('hidden');
}

function clearError() {
  joinError.classList.add('hidden');
}

joinBtn.addEventListener('click', attemptJoin);
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptJoin();
});

function attemptJoin() {
  clearError();
  const code = codeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (code.length !== 4) { showError('Enter a 4-letter room code.'); return; }
  if (!name) { showError('Enter your name.'); return; }

  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining…';
  socket.emit('join-room', { code, name });
}

socket.on('join-success', ({ code, name }) => {
  // Store in sessionStorage for the play page
  sessionStorage.setItem('bb_code', code);
  sessionStorage.setItem('bb_name', name);
  sessionStorage.setItem('bb_socket', socket.id);
  location.href = '/play';
});

socket.on('join-error', ({ message }) => {
  showError(message);
  joinBtn.disabled = false;
  joinBtn.textContent = 'Join Game';
});
