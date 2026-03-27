const { topicQueries, parseTopicClues } = require('./db');

// In-memory room state
const rooms = new Map();

const ROUND_DURATION = 60; // seconds

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
    players: [],          // { id, name, score, socketId }
    state: 'lobby',       // lobby | round | scoring | ended
    currentRound: 0,
    currentTopic: null,
    currentClueIndex: 0,
    describerId: null,
    timer: null,
    timeLeft: ROUND_DURATION,
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
  if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: 'Name already taken in this room' };
  }

  const player = {
    id: socketId,
    socketId,
    name,
    score: 0
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

function pickTopic(room) {
  const allApproved = topicQueries.getApproved.all().map(parseTopicClues);
  const unused = allApproved.filter(t => !room.usedTopicIds.has(t.id));
  if (unused.length === 0) {
    // Reset used topics if we've exhausted them
    room.usedTopicIds = new Set();
    return allApproved[Math.floor(Math.random() * allApproved.length)];
  }
  return unused[Math.floor(Math.random() * unused.length)];
}

function pickDescriber(room) {
  // Rotate through players so everyone gets a turn
  if (room.players.length === 0) return null;
  const idx = room.currentRound % room.players.length;
  return room.players[idx];
}

function startRound(room) {
  const topic = pickTopic(room);
  if (!topic) return { error: 'No approved topics available' };

  const describer = pickDescriber(room);
  if (!describer) return { error: 'No players in room' };

  room.usedTopicIds.add(topic.id);
  room.currentTopic = topic;
  room.currentClueIndex = 0;
  room.describerId = describer.socketId;
  room.state = 'round';
  room.currentRound++;
  room.timeLeft = ROUND_DURATION;

  // Only include filled clues
  const activeClues = topic.clues.filter(c => c.response && c.response.trim() !== '');

  return {
    topic,
    describer,
    activeClues,
    category: topic.category
  };
}

function nextClue(room) {
  const topic = room.currentTopic;
  if (!topic) return null;
  const activeClues = topic.clues.filter(c => c.response && c.response.trim() !== '');
  room.currentClueIndex++;
  if (room.currentClueIndex >= activeClues.length) return null;
  return activeClues[room.currentClueIndex];
}

function getCurrentClue(room) {
  const topic = room.currentTopic;
  if (!topic) return null;
  const activeClues = topic.clues.filter(c => c.response && c.response.trim() !== '');
  return activeClues[room.currentClueIndex] || null;
}

function checkGuess(room, guess) {
  if (!room.currentTopic) return false;
  const topic = room.currentTopic.topic.toLowerCase().trim();
  const g = guess.toLowerCase().trim();
  // Accept if guess contains the topic word or vice versa (handles "the X" etc.)
  return g === topic || g.includes(topic) || topic.includes(g);
}

function awardPoints(room, guesserSocketId) {
  const guesser = room.players.find(p => p.socketId === guesserSocketId);
  const describer = room.players.find(p => p.socketId === room.describerId);

  // Points: guesser gets more points for guessing earlier (based on clue index)
  const activeClues = room.currentTopic.clues.filter(c => c.response && c.response.trim() !== '');
  const cluesRevealed = room.currentClueIndex + 1;
  const guesserPoints = Math.max(5, 10 - (cluesRevealed - 1) * 2); // 10, 8, 6... min 5

  if (guesser) guesser.score += guesserPoints;
  if (describer) describer.score += 5; // flat points for describer

  return { guesserPoints, describerPoints: 5, guesser, describer };
}

function endRound(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
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
  pickTopic,
  startRound,
  nextClue,
  getCurrentClue,
  checkGuess,
  awardPoints,
  endRound,
  deleteRoom,
  ROUND_DURATION
};
