// ── Player / Phone Game Screen ────────────────────────────────────────────────

const socket = io();

// Pull stored join info (set by join.js before redirect)
const myCode = sessionStorage.getItem('bb_code');
const myName = sessionStorage.getItem('bb_name');

if (!myCode || !myName) {
  location.href = '/join';
}

let myRole = null;
let myScore = 0;
let clues = [];
let currentClueIndex = 0;

// ── Screen helpers ────────────────────────────────────────────────────────────
const allScreens = [
  'lobby-wait-screen',
  'describer-screen',
  'guesser-screen',
  'round-end-screen',
  'gameover-screen',
];

function showScreen(id) {
  allScreens.forEach(s => document.getElementById(s).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ── Elements ──────────────────────────────────────────────────────────────────
const lobbyCode        = document.getElementById('lobby-code');
const lobbyPlayerName  = document.getElementById('lobby-player-name');
const lobbyPlayerList  = document.getElementById('lobby-player-list');

const descTopicWord    = document.getElementById('desc-topic-word');
const descClueList     = document.getElementById('desc-clue-list');
const nextCluePhoneBtn = document.getElementById('next-clue-phone-btn');
const clueProgressText = document.getElementById('clue-progress-text');

const guesserCategory  = document.getElementById('guesser-category');
const guesserDescrName = document.getElementById('guesser-describer-name');
const guesserLatestClue= document.getElementById('guesser-latest-clue');
const guesserClueNum   = document.getElementById('guesser-clue-num');
const guesserClueStart = document.getElementById('guesser-clue-starter');
const guesserClueResp  = document.getElementById('guesser-clue-response');
const guessInput       = document.getElementById('guess-input');
const guessSubmitBtn   = document.getElementById('guess-submit-btn');
const guessFeedback    = document.getElementById('guess-feedback');
const guesserScoreEl   = document.getElementById('guesser-score');

const roundEndTitle    = document.getElementById('round-end-title');
const roundEndAnswer   = document.getElementById('round-end-answer');
const roundEndSub      = document.getElementById('round-end-sub');

const finalPodium      = document.getElementById('final-podium');

// ── Init ──────────────────────────────────────────────────────────────────────
lobbyCode.textContent = myCode;
lobbyPlayerName.textContent = myName;
showScreen('lobby-wait-screen');

// Re-join on reconnect (socket reconnects with new id)
socket.on('connect', () => {
  socket.emit('join-room', { code: myCode, name: myName });
});

// ── Socket events ─────────────────────────────────────────────────────────────

socket.on('join-success', () => {
  // Already on lobby screen — nothing needed
});

socket.on('join-error', ({ message }) => {
  // If we can't rejoin (game in progress, etc.), bounce back to join
  alert(message);
  location.href = '/join';
});

socket.on('player-joined', ({ players }) => {
  renderLobbyPlayers(players);
});

socket.on('player-left', ({ players }) => {
  renderLobbyPlayers(players);
});

socket.on('round-start', (data) => {
  myRole = data.role;

  if (data.role === 'describer') {
    clues = data.clues;
    currentClueIndex = 0;
    descTopicWord.textContent = data.topic;
    renderDescClues(clues, 0);
    updateClueProgress();
    showScreen('describer-screen');

  } else if (data.role === 'guesser') {
    guesserCategory.textContent = data.category;
    guesserDescrName.textContent = data.describerName;
    guesserLatestClue.style.display = 'none';
    guessInput.value = '';
    guessFeedback.textContent = '';
    guessFeedback.className = 'guess-feedback';
    showScreen('guesser-screen');
    setTimeout(() => guessInput.focus(), 300);
  }
});

socket.on('clue-revealed', ({ clueIndex, clue }) => {
  currentClueIndex = clueIndex;

  if (myRole === 'describer') {
    renderDescClues(clues, clueIndex);
    updateClueProgress();
  } else if (myRole === 'guesser') {
    guesserLatestClue.style.display = '';
    guesserClueNum.textContent = `Clue ${clueIndex + 1}`;
    guesserClueStart.textContent = clue.starter + '… ';
    guesserClueResp.textContent = clue.response;
    // Animate
    guesserLatestClue.classList.remove('anim-slide-in');
    void guesserLatestClue.offsetWidth;
    guesserLatestClue.classList.add('anim-slide-in');
  }
});

socket.on('no-more-clues', () => {
  if (myRole === 'describer') {
    nextCluePhoneBtn.disabled = true;
    clueProgressText.textContent = 'All clues revealed!';
  }
});

socket.on('wrong-guess', ({ guess }) => {
  guessFeedback.textContent = `"${guess}" — not quite!`;
  guessFeedback.className = 'guess-feedback wrong';
  guessInput.value = '';
  guessInput.focus();
  setTimeout(() => {
    guessFeedback.textContent = '';
    guessFeedback.className = 'guess-feedback';
  }, 2000);
});

socket.on('correct-guess', ({ guesser, topic, guesserPoints, describerPoints, describerName }) => {
  const iAmGuesser = guesser === myName;
  const iAmDescriber = myRole === 'describer';

  if (iAmGuesser) {
    myScore += guesserPoints;
    guesserScoreEl.textContent = myScore;
    roundEndTitle.textContent = '🎉 You got it!';
    roundEndSub.textContent = `+${guesserPoints} points`;
  } else if (iAmDescriber) {
    myScore += describerPoints;
    roundEndTitle.textContent = `✓ ${guesser} guessed it!`;
    roundEndSub.textContent = `+${describerPoints} points for you`;
  } else {
    roundEndTitle.textContent = `✓ ${guesser} guessed it!`;
    roundEndSub.textContent = '';
  }

  roundEndAnswer.textContent = topic;
  showScreen('round-end-screen');
});

socket.on('round-end', ({ reason, topic }) => {
  roundEndTitle.textContent = reason === 'timeout' ? '⏰ Time\'s up!' : 'Round over!';
  roundEndAnswer.textContent = topic;
  roundEndSub.textContent = '';
  showScreen('round-end-screen');
});

socket.on('show-scores', ({ players }) => {
  // Update my score from server-side truth
  const me = players.find(p => p.name === myName);
  if (me) {
    myScore = me.score;
    guesserScoreEl.textContent = myScore;
  }
  // Stay on round-end screen — host controls flow
});

socket.on('game-end', ({ players }) => {
  renderFinalPodium(players);
  showScreen('gameover-screen');
});

socket.on('host-left', () => {
  alert('The host disconnected. Game over!');
  location.href = '/';
});

// ── UI Actions ────────────────────────────────────────────────────────────────

nextCluePhoneBtn.addEventListener('click', () => {
  socket.emit('next-clue');
});

guessSubmitBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitGuess();
});

function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;
  socket.emit('submit-guess', { guess });
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderLobbyPlayers(players) {
  lobbyPlayerList.innerHTML = '';
  players.forEach(p => {
    const item = document.createElement('div');
    item.className = 'player-list-item';
    item.textContent = p.name + (p.name === myName ? ' (you)' : '');
    lobbyPlayerList.appendChild(item);
  });
}

function renderDescClues(clues, currentIdx) {
  descClueList.innerHTML = '';
  clues.forEach((clue, i) => {
    const item = document.createElement('div');
    item.className = 'clue-item' +
      (i === currentIdx ? ' current' : i < currentIdx ? ' past' : '');
    item.innerHTML = `<span class="clue-starter">${esc(clue.starter)}… </span><span class="clue-response">${esc(clue.response)}</span>`;
    descClueList.appendChild(item);
  });
}

function updateClueProgress() {
  const remaining = clues.length - currentClueIndex - 1;
  clueProgressText.textContent = remaining > 0
    ? `${remaining} clue${remaining > 1 ? 's' : ''} remaining`
    : 'Last clue!';
  nextCluePhoneBtn.disabled = currentClueIndex >= clues.length - 1;
}

function renderFinalPodium(players) {
  finalPodium.innerHTML = '';
  players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'podium-row';
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankSymbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    row.innerHTML = `
      <div class="podium-rank ${rankClass}">${rankSymbol}</div>
      <div class="podium-name">${esc(p.name)}${p.name === myName ? ' (you)' : ''}</div>
      <div class="podium-pts">${p.score}</div>
    `;
    finalPodium.appendChild(row);
  });
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
