// ── Host / TV Screen ─────────────────────────────────────────────────────────

const socket = io();

const TOTAL_TIME = 180;
let currentClueIndex = 0;
let totalClues = 0;
let timerInterval = null;
let currentTimeLeft = TOTAL_TIME;
let timerVisible = false;
let hostTimerInterval = null;

// ── Screens ──────────────────────────────────────────────────────────────────
const screens = {
  create:    document.getElementById('create-screen'),
  lobby:     document.getElementById('lobby-screen'),
  round:     document.getElementById('round-screen'),
  scores:    document.getElementById('scores-screen'),
  gameover:  document.getElementById('gameover-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ── Elements ──────────────────────────────────────────────────────────────────
const roomCodeVal       = document.getElementById('room-code-val');
const roomCodeBar       = document.getElementById('room-code-bar');
const joinUrlDisplay    = document.getElementById('join-url-display');
const playerGrid        = document.getElementById('player-grid');
const startBtn          = document.getElementById('start-btn');
const playerCountHint   = document.getElementById('player-count-hint');
const lobbyTitle        = document.getElementById('lobby-title');
const lobbyControls     = document.getElementById('lobby-controls');

const roundNumber       = document.getElementById('round-number');
const describerName     = document.getElementById('describer-name');
const categoryDisplay   = document.getElementById('category-display');
const clueStage         = document.getElementById('clue-stage');
const clueNumber        = document.getElementById('clue-number');
const clueHistoryList   = document.getElementById('clue-history-list');
const clueDots          = document.getElementById('clue-dots');
const timerArc          = document.getElementById('timer-arc');
const timerText         = document.getElementById('timer-text');
const guessesStream     = document.getElementById('guesses-stream');
const answerRevealArea  = document.getElementById('answer-reveal-area');
const answerRevealWord  = document.getElementById('answer-reveal-word');
const roundEndReason    = document.getElementById('round-end-reason');

const scoreList         = document.getElementById('score-list');
const scoresTitle       = document.getElementById('scores-title');
const finalScoreList    = document.getElementById('final-score-list');

// ── Socket events ─────────────────────────────────────────────────────────────

socket.on('room-created', ({ code }) => {
  roomCodeVal.textContent = code;
  roomCodeBar.style.display = 'flex';
  joinUrlDisplay.textContent = `${location.host}/join`;
  lobbyTitle.textContent = 'Waiting for players…';
  lobbyControls.style.display = '';
  showScreen('lobby');
});

socket.on('player-joined', ({ players, newPlayer }) => {
  renderPlayerGrid(players);
  if (players.length >= 2) {
    startBtn.disabled = false;
    playerCountHint.textContent = `${players.length} player${players.length > 1 ? 's' : ''} ready`;
  } else {
    playerCountHint.textContent = 'Need at least 2 players';
  }
});

socket.on('player-left', ({ players }) => {
  renderPlayerGrid(players);
});

socket.on('game-error', ({ message }) => {
  alert(message);
});

socket.on('round-picking', ({ describerName }) => {
  lobbyTitle.textContent = `${describerName} is picking a topic…`;
  lobbyControls.style.display = 'none';
  playerCountHint.textContent = '';
  showScreen('lobby');
});

socket.on('round-start', ({ role, topic, category, describerName: dn, totalClues: tc, roundNumber: rn, lap }) => {
  if (role !== 'host') return;

  currentClueIndex = -1;
  totalClues = tc;
  roundNumber.textContent = rn;
  describerName.textContent = dn;
  categoryDisplay.textContent = category;

  // Lap badge
  document.getElementById('lap-badge').classList.toggle('hidden', lap !== 2);

  // Reset
  timerVisible = false;
  if (hostTimerInterval) { clearInterval(hostTimerInterval); hostTimerInterval = null; }
  answerRevealArea.classList.add('hidden');
  clueStage.classList.remove('hidden');
  clueNumber.textContent = 'Waiting for first clue…';
  clueHistoryList.innerHTML = '';
  guessesStream.innerHTML = '';
  document.getElementById('round-controls').style.display = '';

  renderClueDots(tc, -1);
  showScreen('round');

  resetTimer();
  document.getElementById('timer-ring').style.opacity = '0';
});

socket.on('guess-phase-start', ({ timeLeft }) => {
  if (!timerVisible) {
    timerVisible = true;
    currentTimeLeft = timeLeft;
    updateTimerDisplay(timeLeft);
    document.getElementById('timer-ring').style.opacity = '1';
  }
});

socket.on('clue-revealed', ({ clueIndex, clue }) => {
  currentClueIndex = clueIndex;
  clueNumber.textContent = `Clue ${clueIndex + 1}`;

  // Add to history — newest on top, previous dimmed
  clueHistoryList.querySelectorAll('.clue-history-item').forEach(el => el.classList.remove('latest'));
  const item = document.createElement('div');
  item.className = 'clue-history-item latest anim-slide-in';
  item.innerHTML = `<span class="chi-starter">${esc(clue.starter)}… </span><span class="chi-response">${esc(clue.response)}</span>`;
  clueHistoryList.prepend(item);

  updateClueDots(clueIndex);

  // First clue: start the 3-minute countdown from exactly 180
  if (clueIndex === 0 && !timerVisible) {
    timerVisible = true;
    currentTimeLeft = TOTAL_TIME;
    updateTimerDisplay(TOTAL_TIME);
    document.getElementById('timer-ring').style.opacity = '1';
    if (hostTimerInterval) clearInterval(hostTimerInterval);
    hostTimerInterval = setInterval(() => {
      currentTimeLeft--;
      updateTimerDisplay(currentTimeLeft);
      if (currentTimeLeft <= 0) { clearInterval(hostTimerInterval); hostTimerInterval = null; }
    }, 1000);
  }
});

socket.on('no-more-clues', () => {
  clueNumber.textContent = 'All clues revealed!';
});

socket.on('guess-made', ({ guesser, guess }) => {
  const item = document.createElement('div');
  item.className = 'guess-item anim-slide-in';
  item.innerHTML = `<span class="guess-player">${esc(guesser)}</span><span class="guess-text">${esc(guess)}</span>`;
  guessesStream.prepend(item);
  while (guessesStream.children.length > 10) {
    guessesStream.removeChild(guessesStream.lastChild);
  }
});

socket.on('timer-tick', () => {
  // Host uses its own client-side interval; server ticks are ignored
});

socket.on('correct-guess', ({ guesser, topic, guesserPoints, describerPoints, describerName: dn }) => {
  if (hostTimerInterval) { clearInterval(hostTimerInterval); hostTimerInterval = null; }
  showCorrectFlash();
  showRoundEnd(`✓ ${guesser} got it!`, topic);
});

socket.on('round-end', ({ reason, topic }) => {
  if (hostTimerInterval) { clearInterval(hostTimerInterval); hostTimerInterval = null; }
  const msg = reason === 'pick-timeout' ? '⏳ Describer timed out!'
            : reason === 'timeout'      ? '⏰ Time\'s up!'
            : 'Round over';
  showRoundEnd(msg, topic);
});

socket.on('show-scores', ({ players, roundNumber: rn, isLastRound }) => {
  scoresTitle.textContent = `After Round ${rn}`;
  renderScoreList(scoreList, players);
  const nextRoundBtn = document.getElementById('next-round-btn');
  if (isLastRound) {
    nextRoundBtn.disabled = true;
    nextRoundBtn.textContent = 'Final round — ending…';
  } else {
    nextRoundBtn.disabled = false;
    nextRoundBtn.textContent = 'Next Round';
  }
  showScreen('scores');
});

socket.on('game-end', ({ players }) => {
  renderScoreList(finalScoreList, players);
  showScreen('gameover');
});

socket.on('host-left', () => {
  alert('Connection lost.');
  location.href = '/';
});

// ── UI Actions ────────────────────────────────────────────────────────────────

document.getElementById('create-btn').addEventListener('click', () => {
  socket.emit('create-room');
});

startBtn.addEventListener('click', () => {
  socket.emit('start-game');
});

document.getElementById('next-round-btn').addEventListener('click', () => {
  socket.emit('next-round');
});

document.getElementById('end-game-btn').addEventListener('click', () => {
  if (confirm('End the game now?')) socket.emit('end-game');
});

document.getElementById('end-game-btn-2').addEventListener('click', () => {
  if (confirm('End the game now?')) socket.emit('end-game');
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPlayerGrid(players) {
  playerGrid.innerHTML = '';
  players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    chip.textContent = p.name;
    playerGrid.appendChild(chip);
  });
}

function renderClueDots(total, current) {
  clueDots.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'clue-dot' + (i === current ? ' active' : '');
    dot.id = `dot-${i}`;
    clueDots.appendChild(dot);
  }
}

function updateClueDots(current) {
  document.querySelectorAll('.clue-dot').forEach((dot, i) => {
    dot.className = 'clue-dot' + (i < current ? ' revealed' : i === current ? ' active' : '');
  });
}

function resetTimer() {
  currentTimeLeft = TOTAL_TIME;
  updateTimerDisplay(TOTAL_TIME);
}

function updateTimerDisplay(timeLeft) {
  timerText.textContent = timeLeft;
  const circumference = 220; // 2π × r=35 ≈ 219.9
  const fraction = timeLeft / TOTAL_TIME;
  const offset = circumference * (1 - fraction);
  timerArc.style.strokeDashoffset = offset;

  const urgent = timeLeft <= 10;
  timerArc.classList.toggle('urgent', urgent);
  timerText.classList.toggle('urgent', urgent);
}

function showRoundEnd(reason, topicWord) {
  clueStage.classList.add('hidden');
  answerRevealArea.classList.remove('hidden');
  roundEndReason.textContent = reason;
  answerRevealWord.textContent = topicWord;
  document.getElementById('round-controls').style.display = 'none';
}

function showCorrectFlash() {
  const flash = document.getElementById('correct-flash');
  flash.classList.remove('hidden');
  setTimeout(() => flash.classList.add('hidden'), 1200);
}

function renderScoreList(container, players) {
  container.innerHTML = '';
  players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.style.setProperty('--i', i);
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankSymbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const streakBadge = (p.streak || 0) >= 2 ? ` <span style="font-size:0.85rem;color:var(--yellow);">🔥 ${p.streak}</span>` : '';
    row.innerHTML = `
      <div class="score-rank ${rankClass}">${rankSymbol}</div>
      <div class="score-name">${esc(p.name)}${streakBadge}</div>
      <div class="score-pts">${p.score} pts</div>
    `;
    container.appendChild(row);
  });
}

function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
