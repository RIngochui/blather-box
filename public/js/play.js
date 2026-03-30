// ── Player / Phone Game Screen ────────────────────────────────────────────────

const socket = io();

const myCode = sessionStorage.getItem('bb_code');
const myName = sessionStorage.getItem('bb_name');

if (!myCode || !myName) {
  location.href = '/join';
}

let myRole = null;
let myScore = 0;

// Describer state
let starters = [];
let selectedStarterIndex = null;
let builtWords = [];
let firstClueSubmitted = false;
let firstStarterText = '';
let pickTimerInterval = null;

const PRESET_WORDS = [
  'similar to', 'like', 'a type of', 'used for', 'found in',
  'associated with', 'related to', 'looks like', 'sounds like',
  'made of', 'part of', 'opposite of', 'bigger than', 'smaller than',
  'often near', 'sometimes called'
];

const CATEGORY_WORDS = {
  'Thing': [
    'small', 'large', 'tiny', 'giant', 'round', 'flat', 'long', 'thin',
    'sharp', 'soft', 'hard', 'heavy', 'light', 'hollow', 'solid', 'transparent',
    'metal', 'plastic', 'wooden', 'glass', 'rubber', 'electric', 'digital',
    'ancient', 'modern', 'common', 'rare', 'portable', 'mechanical',
    'tool', 'machine', 'device', 'container', 'weapon', 'toy', 'instrument',
    'furniture', 'vehicle', 'symbol', 'surface', 'handle', 'button', 'screen',
    'liquid', 'powder', 'fabric', 'wire', 'tube', 'box', 'bag', 'ring',
  ],
  'Person': [
    'famous', 'fictional', 'real', 'historical', 'modern', 'ancient',
    'powerful', 'controversial', 'beloved', 'feared', 'respected', 'talented',
    'old', 'young', 'rich', 'poor', 'brave', 'smart', 'creative', 'evil', 'good',
    'actor', 'actress', 'singer', 'musician', 'artist', 'painter', 'writer',
    'scientist', 'inventor', 'explorer', 'politician', 'president', 'king', 'queen',
    'athlete', 'soldier', 'hero', 'villain', 'leader', 'comedian', 'director',
    'philosopher', 'doctor', 'astronaut', 'spy', 'warrior', 'rebel',
    'American', 'British', 'French', 'Chinese', 'Japanese', 'German', 'Italian',
  ],
  'Place': [
    'famous', 'large', 'small', 'ancient', 'modern', 'historic', 'remote',
    'tropical', 'cold', 'hot', 'dry', 'wet', 'mountainous', 'flat', 'underground',
    'underwater', 'urban', 'rural', 'sacred', 'dangerous', 'peaceful',
    'country', 'city', 'town', 'island', 'continent', 'mountain', 'volcano',
    'ocean', 'sea', 'river', 'lake', 'desert', 'forest', 'jungle', 'cave',
    'castle', 'tower', 'temple', 'stadium', 'beach', 'park', 'wall', 'bridge',
    'north', 'south', 'east', 'west', 'Europe', 'Asia', 'Africa', 'America',
  ],
  'Food/Drink': [
    'sweet', 'sour', 'spicy', 'bitter', 'salty', 'savory', 'bland',
    'hot', 'cold', 'warm', 'raw', 'cooked', 'fried', 'baked', 'grilled',
    'crunchy', 'soft', 'creamy', 'liquid', 'thick', 'thin', 'rich', 'light',
    'popular', 'traditional', 'exotic', 'rare', 'expensive', 'healthy',
    'fruit', 'vegetable', 'meat', 'fish', 'grain', 'bread', 'sauce', 'soup',
    'dessert', 'snack', 'drink', 'tea', 'coffee', 'alcohol', 'juice', 'milk',
    'spice', 'cheese', 'egg', 'noodle', 'rice', 'pasta', 'chocolate', 'sugar',
    'ingredient', 'flavour', 'aroma', 'texture', 'colour',
  ],
  'Activity': [
    'indoor', 'outdoor', 'competitive', 'solo', 'social', 'team',
    'physical', 'mental', 'creative', 'dangerous', 'safe', 'relaxing',
    'extreme', 'professional', 'casual', 'popular', 'rare', 'expensive',
    'fast', 'slow', 'technical', 'artistic', 'seasonal', 'underwater',
    'sport', 'game', 'hobby', 'exercise', 'skill', 'competition', 'challenge',
    'performance', 'art', 'music', 'dance', 'race', 'match', 'climb',
    'water', 'air', 'land', 'snow', 'ice', 'ball', 'equipment', 'body',
    'team', 'partner', 'audience', 'stage', 'arena', 'outdoors', 'nature',
  ],
  'Movie/Show': [
    'animated', 'live-action', 'classic', 'modern', 'old', 'new',
    'popular', 'famous', 'award-winning', 'fictional', 'based-on', 'true',
    'funny', 'scary', 'sad', 'dark', 'violent', 'family-friendly',
    'American', 'Japanese', 'British', 'Korean', 'French',
    'film', 'movie', 'series', 'show', 'sequel', 'prequel', 'remake', 'reboot',
    'comedy', 'drama', 'thriller', 'horror', 'action', 'fantasy', 'sci-fi',
    'romance', 'documentary', 'animation', 'anime', 'superhero', 'musical',
    'character', 'hero', 'villain', 'robot', 'alien', 'monster', 'wizard',
    'universe', 'story', 'adventure', 'war', 'crime', 'mystery', 'space',
  ],
  'General': [
    'good', 'bad', 'big', 'small', 'large', 'tiny', 'simple', 'complex',
    'basic', 'advanced', 'common', 'rare', 'normal', 'unusual', 'unique',
    'important', 'minor', 'useful', 'useless', 'clear', 'strong', 'weak',
    'flexible', 'rigid', 'fast', 'slow', 'hot', 'cold', 'loud', 'quiet',
    'thing', 'object', 'item', 'part', 'feature', 'system', 'concept',
    'idea', 'example', 'type', 'kind', 'group', 'world', 'country',
  ],
};

let wordBankWords = [];   // current sampled category words
let guessedWords = [];    // words added from guesses — persist through refreshes
let currentCategoryWords = [];

function sampleWordBank(allWordBankWords) {
  currentCategoryWords = allWordBankWords;
  const size = Math.max(6, Math.floor(allWordBankWords.length * 0.25));
  const shuffled = [...allWordBankWords].sort(() => Math.random() - 0.5);
  wordBankWords = shuffled.slice(0, size);
}

// ── Screen helpers ────────────────────────────────────────────────────────────
const allScreens = [
  'topic-pick-screen',
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
const lobbyWaitText    = document.getElementById('lobby-wait-text');

const topicChoicesList = document.getElementById('topic-choices-list');

const descTopicWord    = document.getElementById('desc-topic-word');
const descStartersList = document.getElementById('desc-starters-list');
const composeArea      = document.getElementById('compose-area');
const composeStarterText = document.getElementById('compose-starter-text');
const builtResponseEl  = document.getElementById('built-response');
const builtPlaceholder = document.getElementById('built-placeholder');
const clearLastWordBtn = document.getElementById('clear-last-word');
const clearAllBtn      = document.getElementById('clear-all-btn');
const descRevealClueBtn = document.getElementById('desc-reveal-clue-btn');
const wordBankLabel    = document.getElementById('word-bank-label');
const descWordBank     = document.getElementById('desc-word-bank');
const descClueList     = document.getElementById('desc-clue-list');

const guesserCategory  = document.getElementById('guesser-category');
const guesserDescrName = document.getElementById('guesser-describer-name');
const guesserLatestClue= document.getElementById('guesser-latest-clue');
const guesserClueNum   = document.getElementById('guesser-clue-num');
const guesserClueStart = document.getElementById('guesser-clue-starter');
const guesserClueResp  = document.getElementById('guesser-clue-response');
const guessHistory     = document.getElementById('guess-history');
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

socket.on('connect', () => {
  socket.emit('join-room', { code: myCode, name: myName });
});

// ── Socket events ─────────────────────────────────────────────────────────────

socket.on('join-success', () => {});

socket.on('join-error', ({ message }) => {
  alert(message);
  location.href = '/join';
});

socket.on('player-joined', ({ players }) => {
  renderLobbyPlayers(players);
});

socket.on('player-left', ({ players }) => {
  renderLobbyPlayers(players);
});

// Describer gets this: show topic choices
socket.on('topic-choices', ({ choices }) => {
  renderTopicChoices(choices);
  showScreen('topic-pick-screen');
});

// Everyone else: wait while describer picks
socket.on('round-picking', ({ describerName }) => {
  lobbyWaitText.textContent = `${describerName} is picking a topic…`;
  showScreen('lobby-wait-screen');
});

socket.on('round-start', (data) => {
  myRole = data.role;

  if (data.role === 'describer') {
    starters = data.starters || [];
    firstClueSubmitted = false;
    firstStarterText = data.firstStarter || starters[0] || '';
    builtWords = [];
    guessedWords = [];
    const allCatWords = CATEGORY_WORDS[data.category] || [];
    const allGeneralWords = CATEGORY_WORDS['General'] || [];
    const allWordBankWords = allCatWords.concat(allGeneralWords);
    sampleWordBank(allWordBankWords);

    descTopicWord.textContent = data.topic;
    descClueList.innerHTML = '';

    // Lap badge
    document.getElementById('desc-lap-badge').classList.toggle('hidden', data.lap !== 2);

    // Pre-select the randomised first starter, show compose area immediately
    selectedStarterIndex = starters.indexOf(firstStarterText);
    composeStarterText.textContent = firstStarterText + '…';
    composeArea.classList.remove('hidden');
    wordBankLabel.classList.remove('hidden');
    renderBuiltResponse();
    renderWordBank();
    renderStarters();

    // Show pick timer — run client-side countdown
    if (pickTimerInterval) clearInterval(pickTimerInterval);
    let pickSecsLeft = 60;
    document.getElementById('pick-timer-val').textContent = pickSecsLeft;
    document.getElementById('pick-timer-area').classList.remove('hidden');
    document.getElementById('pick-timer-area').classList.remove('urgent');
    pickTimerInterval = setInterval(() => {
      pickSecsLeft--;
      document.getElementById('pick-timer-val').textContent = pickSecsLeft;
      if (pickSecsLeft <= 10) document.getElementById('pick-timer-area').classList.add('urgent');
      if (pickSecsLeft <= 0) {
        clearInterval(pickTimerInterval);
        pickTimerInterval = null;
        // Auto-submit whatever the describer has built so far
        if (builtWords.length > 0 && selectedStarterIndex !== null) {
          submitBuiltClue();
        }
      }
    }, 1000);

    showScreen('describer-screen');

  } else if (data.role === 'guesser') {
    guesserCategory.textContent = data.category;
    guesserDescrName.textContent = data.describerName;
    guesserLatestClue.style.display = 'none';
    guessInput.value = '';
    guessInput.disabled = true;
    guessSubmitBtn.disabled = true;
    guessFeedback.textContent = 'Waiting for first clue…';
    guessFeedback.className = 'guess-feedback';
    guessHistory.innerHTML = '';
    document.getElementById('guesser-lap-badge').classList.toggle('hidden', data.lap !== 2);
    showScreen('guesser-screen');
  }
});

socket.on('pick-tick', () => {
  // Client-side interval handles display; server tick is just a heartbeat
});

socket.on('guess-phase-start', () => {
  if (pickTimerInterval) { clearInterval(pickTimerInterval); pickTimerInterval = null; }
  document.getElementById('pick-timer-area').classList.add('hidden');
});

socket.on('clue-revealed', ({ clueIndex, clue }) => {
  if (myRole === 'describer') {
    const item = document.createElement('div');
    item.className = 'clue-item past';
    item.innerHTML = `<span class="clue-starter">${esc(clue.starter)}… </span><span class="clue-response">${esc(clue.response)}</span>`;
    descClueList.appendChild(item);

    // After first clue, unlock starter selection
    if (clueIndex === 0) {
      firstClueSubmitted = true;
      document.getElementById('pick-timer-area').classList.add('hidden');
    }

    // Reset compose and refresh word bank
    builtWords = [];
    selectedStarterIndex = null;
    composeArea.classList.add('hidden');
    sampleWordBank(currentCategoryWords);
    renderBuiltResponse();
    renderWordBank();
    renderStarters();

  } else if (myRole === 'guesser') {
    if (clueIndex === 0) {
      guessInput.disabled = false;
      guessSubmitBtn.disabled = false;
      guessFeedback.textContent = '';
      setTimeout(() => guessInput.focus(), 100);
    }
    guesserLatestClue.style.display = '';
    guesserClueNum.textContent = `Clue ${clueIndex + 1}`;
    guesserClueStart.textContent = clue.starter + '… ';
    guesserClueResp.textContent = clue.response;
    guesserLatestClue.classList.remove('anim-slide-in');
    void guesserLatestClue.offsetWidth;
    guesserLatestClue.classList.add('anim-slide-in');
  }
});

socket.on('no-more-clues', () => {
  // No-op: unlimited clues allowed
});

socket.on('guess-made', ({ guesser, guess }) => {
  if (myRole === 'describer') {
    addGuessToWordBank(guess);
  }
});

socket.on('wrong-guess', ({ guess }) => {
  addToGuessHistory(guess);
  guessFeedback.textContent = `"${guess}" — not quite!`;
  guessFeedback.className = 'guess-feedback wrong';
  guessInput.value = '';
  guessInput.focus();
  setTimeout(() => {
    guessFeedback.textContent = '';
    guessFeedback.className = 'guess-feedback';
  }, 2000);
});

socket.on('correct-guess', ({ guesser, topic, guesserPoints, describerPoints, guesserStreak }) => {
  const iAmGuesser = guesser === myName;
  const iAmDescriber = myRole === 'describer';

  if (iAmGuesser) {
    myScore += guesserPoints;
    guesserScoreEl.textContent = myScore;
    roundEndTitle.textContent = 'You got it!';
    const streakText = guesserStreak >= 2 ? ` · 🔥 ${guesserStreak} in a row!` : '';
    roundEndSub.textContent = `+${guesserPoints} points${streakText}`;
  } else if (iAmDescriber) {
    myScore += describerPoints;
    roundEndTitle.textContent = `${guesser} guessed it!`;
    roundEndSub.textContent = `+${describerPoints} points for you`;
  } else {
    roundEndTitle.textContent = `${guesser} guessed it!`;
    roundEndSub.textContent = '';
  }

  roundEndAnswer.textContent = topic;
  showScreen('round-end-screen');
});

socket.on('round-end', ({ reason, topic }) => {
  if (pickTimerInterval) { clearInterval(pickTimerInterval); pickTimerInterval = null; }
  document.getElementById('pick-timer-area').classList.add('hidden');
  if (reason === 'pick-timeout') {
    roundEndTitle.textContent = myRole === 'describer' ? 'Time\'s up! Reveal a clue faster!' : 'Describer ran out of time!';
  } else {
    roundEndTitle.textContent = reason === 'timeout' ? 'Time\'s up!' : 'Round over!';
  }
  roundEndAnswer.textContent = topic;
  roundEndSub.textContent = '';
  showScreen('round-end-screen');
});

socket.on('show-scores', ({ players }) => {
  const me = players.find(p => p.name === myName);
  if (me) {
    myScore = me.score;
    guesserScoreEl.textContent = myScore;
  }
});

socket.on('game-end', ({ players }) => {
  renderFinalPodium(players);
  showScreen('gameover-screen');
});

socket.on('host-left', () => {
  alert('The host disconnected. Game over!');
  location.href = '/';
});

// ── Topic Pick UI ─────────────────────────────────────────────────────────────

function renderTopicChoices(choices) {
  topicChoicesList.innerHTML = '';
  choices.forEach(({ id, topic, category }) => {
    const card = document.createElement('button');
    card.className = 'topic-choice-card';
    card.innerHTML = `
      <div class="topic-choice-category">${esc(category)}</div>
      <div class="topic-choice-name">${esc(topic)}</div>
    `;
    card.addEventListener('click', () => {
      socket.emit('pick-topic', { topicId: id });
      // Disable all cards after pick
      topicChoicesList.querySelectorAll('.topic-choice-card').forEach(c => c.disabled = true);
      card.classList.add('selected');
    });
    topicChoicesList.appendChild(card);
  });
}

// ── Describer UI ──────────────────────────────────────────────────────────────

function renderStarters() {
  descStartersList.innerHTML = '';
  if (!firstClueSubmitted) {
    // First clue: starter is locked — just show the note, compose area is already open
    const note = document.createElement('div');
    note.className = 'starter-locked-note';
    note.textContent = 'First clue starter is randomised — pick words below!';
    descStartersList.appendChild(note);
    return;
  }
  // After first clue: free choice
  starters.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'starter-btn';
    btn.textContent = s + '…';
    btn.addEventListener('click', () => selectStarter(i, s));
    descStartersList.appendChild(btn);
  });
}

function selectStarter(index, starterText) {
  selectedStarterIndex = index;
  composeStarterText.textContent = starterText + '…';
  composeArea.classList.remove('hidden');
  wordBankLabel.classList.remove('hidden');
  renderWordBank();
  document.querySelectorAll('.starter-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });
}

function renderBuiltResponse() {
  // Remove all word tokens, keep placeholder
  builtResponseEl.querySelectorAll('.built-word').forEach(el => el.remove());
  if (builtWords.length === 0) {
    builtPlaceholder.style.display = '';
  } else {
    builtPlaceholder.style.display = 'none';
    builtWords.forEach(word => {
      const token = document.createElement('span');
      token.className = 'built-word';
      token.textContent = word;
      builtResponseEl.appendChild(token);
    });
  }
  descRevealClueBtn.disabled = builtWords.length === 0 || selectedStarterIndex === null;
}

function renderWordBank() {
  descWordBank.innerHTML = '';
  const allWords = [...wordBankWords, ...guessedWords];
  allWords.forEach((word, i) => {
    const chip = document.createElement('button');
    chip.className = 'word-chip' + (i >= wordBankWords.length ? ' from-guess' : '');
    chip.textContent = word;
    chip.addEventListener('click', () => {
      builtWords.push(word);
      renderBuiltResponse();
    });
    descWordBank.appendChild(chip);
  });
}

function addGuessToWordBank(guess) {
  const allExisting = [...wordBankWords, ...guessedWords].map(x => x.toLowerCase());
  const words = guess.trim().split(/\s+/);
  let changed = false;
  words.forEach(w => {
    if (w && !allExisting.includes(w.toLowerCase())) {
      guessedWords.push(w);
      changed = true;
    }
  });
  const full = guess.trim();
  if (words.length > 1 && !allExisting.includes(full.toLowerCase())) {
    guessedWords.push(full);
    changed = true;
  }
  if (changed) renderWordBank();
}

clearLastWordBtn.addEventListener('click', () => {
  builtWords.pop();
  renderBuiltResponse();
});

clearAllBtn.addEventListener('click', () => {
  builtWords = [];
  renderBuiltResponse();
});

document.getElementById('refresh-word-bank-btn').addEventListener('click', () => {
  sampleWordBank(currentCategoryWords);
  renderWordBank();
});

descRevealClueBtn.addEventListener('click', submitBuiltClue);

function submitBuiltClue() {
  if (builtWords.length === 0 || selectedStarterIndex === null) return;
  const starter = starters[selectedStarterIndex];
  const response = builtWords.join(' ');
  socket.emit('submit-clue', { starter, response });
}

// ── Guesser UI ────────────────────────────────────────────────────────────────

guessSubmitBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitGuess();
});

function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;
  socket.emit('submit-guess', { guess });
}

function addToGuessHistory(guess) {
  const item = document.createElement('div');
  item.className = 'guess-history-item anim-slide-in';
  item.textContent = guess;
  guessHistory.prepend(item);
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
