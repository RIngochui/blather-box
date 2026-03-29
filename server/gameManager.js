const { topicQueries } = require('./db');
const CATEGORY_STARTERS = require('./categoryStarters');

// In-memory room state
const rooms = new Map();

const PICK_DURATION  = 60;  // seconds describer has to submit first clue
const GUESS_DURATION = 180; // seconds for guessers once cluing starts

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // skip I and O
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(hostSocketId) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    hostSocketId,
    players: [],          // { id, name, score, streak, socketId }
    state: 'lobby',       // lobby | picking | round | scoring | ended
    currentRound: 0,
    currentTopic: null,
    currentClueIndex: 0,
    submittedClues: [],
    describerId: null,
    pendingDescriberId: null,
    pendingTopicChoices: [],
    timer: null,
    pickTimer: null,
    firstClueSubmitted: false,
    guessTimeLeft: GUESS_DURATION,
    pickTimeLeft: PICK_DURATION,
    lap: 1,
    playerCountAtStart: 0,
    usedTopicIds: new Set()
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.hostSocketId === socketId) return room;
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

function addPlayer(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.state !== 'lobby') return { error: 'Game already in progress' };
  if ((name || '').toLowerCase() === 'admin') return { error: '"Admin" is a reserved name. Please choose another.' };
  if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: 'Name already taken in this room' };
  }

  const player = {
    id: socketId,
    socketId,
    name,
    score: 0,
    streak: 0
  };
  room.players.push(player);
  return { player, room };
}

function removePlayer(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;

  if (room.hostSocketId === socketId) {
    // Host disconnected — remove room
    if (room.timer) clearInterval(room.timer);
    rooms.delete(room.code);
    return { roomCode: room.code, hostLeft: true };
  }

  const idx = room.players.findIndex(p => p.socketId === socketId);
  if (idx !== -1) room.players.splice(idx, 1);
  return { roomCode: room.code, room, hostLeft: false };
}

function prepareTopicChoices(room, count = 3) {
  const allApproved = topicQueries.getApproved.all();
  const unused = allApproved.filter(t => !room.usedTopicIds.has(t.id));
  const pool = unused.length >= count ? unused : allApproved;
  // Fisher-Yates shuffle slice
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const choices = shuffled.slice(0, Math.min(count, shuffled.length));

  const describer = pickDescriber(room);
  room.pendingDescriberId = describer ? describer.socketId : null;
  room.pendingTopicChoices = choices;
  room.state = 'picking';

  return { describer, choices };
}

function pickDescriber(room) {
  // Rotate through players so everyone gets a turn
  if (room.players.length === 0) return null;
  const idx = room.currentRound % room.players.length;
  return room.players[idx];
}

function startRound(room, topicId) {
  const topic = room.pendingTopicChoices.find(t => t.id === topicId) || null;
  if (!topic) return { error: 'Invalid topic selection' };

  const describer = room.players.find(p => p.socketId === room.pendingDescriberId) || null;
  if (!describer) return { error: 'No describer found' };

  room.pendingDescriberId = null;
  room.pendingTopicChoices = [];
  room.usedTopicIds.add(topic.id);
  room.currentTopic = topic;
  room.currentClueIndex = 0;
  room.submittedClues = [];
  room.describerId = describer.socketId;
  room.state = 'round';
  room.currentRound++;
  room.firstClueSubmitted = false;
  room.guessTimeLeft = GUESS_DURATION;
  room.lap = (room.playerCountAtStart > 0 && room.currentRound > room.playerCountAtStart) ? 2 : 1;

  const starters = CATEGORY_STARTERS[topic.category] || [];
  const firstStarter = starters[Math.floor(Math.random() * starters.length)] || starters[0];

  return { topic, describer, starters, category: topic.category, firstStarter, lap: room.lap };
}

function submitClue(room, starter, response) {
  const clue = { starter, response };
  room.submittedClues.push(clue);
  room.currentClueIndex = room.submittedClues.length - 1;
  return { clue, clueIndex: room.currentClueIndex };
}

function checkGuess(room, guess) {
  if (!room.currentTopic) return false;
  const g = guess.toLowerCase().trim();

  const matches = (target) => {
    const t = target.toLowerCase().trim();
    return g === t || g.includes(t) || t.includes(g);
  };

  if (matches(room.currentTopic.topic)) return true;

  // Check aliases
  let aliases = room.currentTopic.aliases;
  if (typeof aliases === 'string') {
    try { aliases = JSON.parse(aliases); } catch { aliases = []; }
  }
  if (Array.isArray(aliases)) {
    return aliases.some(a => matches(a));
  }
  return false;
}

function awardPoints(room, guesserSocketId) {
  const guesser = room.players.find(p => p.socketId === guesserSocketId);
  const describer = room.players.find(p => p.socketId === room.describerId);

  const timeLeft = room.guessTimeLeft || 0;
  const timeBonus = Math.floor((timeLeft / GUESS_DURATION) * 15); // 0–15
  const currentStreak = guesser ? (guesser.streak || 0) : 0;
  const streakBonus = Math.min(currentStreak * 2, 10); // 0, 2, 4… max 10

  let guesserPoints  = 5 + timeBonus + streakBonus;
  let describerPoints = 3 + Math.floor((timeLeft / GUESS_DURATION) * 7); // 3–10

  if (room.lap === 2) {
    guesserPoints  *= 2;
    describerPoints *= 2;
  }

  if (guesser) {
    guesser.score += guesserPoints;
    guesser.streak = currentStreak + 1;
  }
  room.players.forEach(p => { if (p.socketId !== guesserSocketId) p.streak = 0; });
  if (describer) describer.score += describerPoints;

  return { guesserPoints, describerPoints, guesser, describer };
}

function shouldGameEnd(room) {
  if (!room.playerCountAtStart) return false;
  return room.currentRound >= room.playerCountAtStart * 2;
}

function resetAllStreaks(room) {
  room.players.forEach(p => { p.streak = 0; });
}

function endRound(room) {
  if (room.timer)     { clearInterval(room.timer);     room.timer     = null; }
  if (room.pickTimer) { clearInterval(room.pickTimer); room.pickTimer = null; }
  room.state = 'scoring';
}

function deleteRoom(code) {
  const room = rooms.get(code);
  if (room && room.timer) clearInterval(room.timer);
  rooms.delete(code);
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  getRoomBySocket,
  addPlayer,
  removePlayer,
  prepareTopicChoices,
  startRound,
  submitClue,
  checkGuess,
  awardPoints,
  resetAllStreaks,
  shouldGameEnd,
  endRound,
  deleteRoom,
  PICK_DURATION,
  GUESS_DURATION,
};
