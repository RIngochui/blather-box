require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const gm = require('./gameManager');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/submit', require('./routes/submit'));

// Page routes
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'host.html')));
app.get('/join', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'join.html')));
app.get('/play', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'play.html')));
app.get('/submit', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'submit.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ─── Socket.io ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // HOST: Create a new room
  socket.on('create-room', () => {
    const room = gm.createRoom(socket.id);
    socket.join(room.code);
    socket.emit('room-created', { code: room.code });
    console.log(`Room created: ${room.code}`);
  });

  // PLAYER: Join a room
  socket.on('join-room', ({ code, name }) => {
    const upperCode = (code || '').toUpperCase().trim();
    const result = gm.addPlayer(upperCode, socket.id, name);
    if (result.error) {
      socket.emit('join-error', { message: result.error });
      return;
    }
    socket.join(upperCode);
    socket.emit('join-success', {
      code: upperCode,
      name: result.player.name,
      playerId: socket.id
    });
    if (result.reconnected) {
      console.log(`${name} reconnected to room ${upperCode}`);
    } else {
      // Tell everyone in the room (including host) about the updated player list
      io.to(upperCode).emit('player-joined', {
        players: result.room.players.map(p => ({ name: p.name, score: p.score })),
        newPlayer: result.player.name
      });
      console.log(`${name} joined room ${upperCode}`);
    }
  });

  // HOST: Start the game
  socket.on('start-game', () => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('game-error', { message: 'Need at least 2 players to start.' });
      return;
    }
    room.playerCountAtStart = room.players.length;
    beginTopicPick(room, io);
  });

  // DESCRIBER: Pick a topic from choices
  socket.on('pick-topic', ({ topicId }) => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.state !== 'picking') return;
    if (socket.id !== room.pendingDescriberId) return;
    beginRound(room, io, topicId);
  });

  // DESCRIBER: Submit a built clue
  socket.on('submit-clue', ({ starter, response }) => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.state !== 'round') return;
    if (socket.id !== room.describerId) return;
    if (!starter || !response || !response.trim()) return;

    const { clue, clueIndex } = gm.submitClue(room, starter, response.trim());
    io.to(room.code).emit('clue-revealed', { clueIndex, clue });

    // First clue → stop pick timer, start guess timer
    if (!room.firstClueSubmitted) {
      room.firstClueSubmitted = true;
      startGuessTimer(room, io);
    }
  });

  // PLAYER: Submit a guess
  socket.on('submit-guess', ({ guess }) => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.state !== 'round') return;
    if (!room.firstClueSubmitted) return; // can't guess before first clue
    // Describer can't guess
    if (socket.id === room.describerId) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    if (gm.checkGuess(room, guess)) {
      // Correct!
      if (room.timer) clearInterval(room.timer);
      const result = gm.awardPoints(room, socket.id);
      gm.endRound(room);

      io.to(room.code).emit('correct-guess', {
        guesser: player.name,
        topic: room.currentTopic.topic,
        guesserPoints: result.guesserPoints,
        describerPoints: result.describerPoints,
        describerName: result.describer ? result.describer.name : '',
        guesserStreak: result.guesser ? result.guesser.streak : 0,
      });

      setTimeout(() => sendScores(room, io), 1500);
    } else {
      // Wrong — private feedback to guesser, broadcast guess to room
      socket.emit('wrong-guess', { guess });
      io.to(room.code).emit('guess-made', { guesser: player.name, guess });
    }
  });

  // HOST: Start next round
  socket.on('next-round', () => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    beginTopicPick(room, io);
  });

  // HOST: End the game
  socket.on('end-game', () => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.timer) clearInterval(room.timer);

    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    io.to(room.code).emit('game-end', {
      players: sorted.map(p => ({ name: p.name, score: p.score }))
    });
    gm.deleteRoom(room.code);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const result = gm.removePlayer(socket.id);
    if (!result) return;

    if (result.hostLeft) {
      io.to(result.roomCode).emit('host-left');
    } else if (result.room) {
      io.to(result.roomCode).emit('player-left', {
        players: result.room.players.map(p => ({ name: p.name, score: p.score }))
      });
    }
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function beginTopicPick(room, io) {
  if (room.timer) clearInterval(room.timer);

  const { describer, choices } = gm.prepareTopicChoices(room);
  if (!describer) {
    io.to(room.code).emit('game-error', { message: 'No players in room' });
    return;
  }

  // Describer only: see topic choices
  io.to(describer.socketId).emit('topic-choices', {
    choices: choices.map(t => ({ id: t.id, topic: t.topic, category: t.category }))
  });

  // Everyone else: show waiting state
  for (const player of room.players) {
    if (player.socketId !== describer.socketId) {
      io.to(player.socketId).emit('round-picking', { describerName: describer.name });
    }
  }
  io.to(room.hostSocketId).emit('round-picking', { describerName: describer.name });
}

function beginRound(room, io, topicId) {
  if (room.timer)     clearInterval(room.timer);
  if (room.pickTimer) clearInterval(room.pickTimer);

  const result = gm.startRound(room, topicId);
  if (result.error) {
    io.to(room.code).emit('game-error', { message: result.error });
    return;
  }

  const { topic, describer, starters, category, firstStarter, lap } = result;

  // Describer: topic, starters, randomised first starter, lap
  io.to(describer.socketId).emit('round-start', {
    role: 'describer',
    topic: topic.topic,
    category,
    starters,
    categoryWords,
    firstStarter,
    lap,
  });

  // Guessers: category only
  for (const player of room.players) {
    if (player.socketId !== describer.socketId) {
      io.to(player.socketId).emit('round-start', {
        role: 'guesser',
        category,
        describerName: describer.name,
        lap,
      });
    }
  }

  // Host: full info
  io.to(room.hostSocketId).emit('round-start', {
    role: 'host',
    topic: topic.topic,
    category,
    describerName: describer.name,
    totalClues: starters.length,
    roundNumber: room.currentRound,
    lap,
  });

  // Pick timer: describer only sees countdown (60 s to send first clue)
  room.pickTimeLeft = gm.PICK_DURATION;
  // Emit immediately so the display starts ticking without a 1-second delay
  io.to(room.describerId).emit('pick-tick', { timeLeft: room.pickTimeLeft });
  room.pickTimer = setInterval(() => {
    room.pickTimeLeft--;
    io.to(room.describerId).emit('pick-tick', { timeLeft: room.pickTimeLeft });

    if (room.pickTimeLeft <= 0) {
      clearInterval(room.pickTimer);
      room.pickTimer = null;
      gm.endRound(room);
      gm.resetAllStreaks(room);
      io.to(room.code).emit('round-end', {
        reason: 'pick-timeout',
        topic: room.currentTopic.topic
      });
      setTimeout(() => sendScores(room, io), 1500);
    }
  }, 1000);
}

function startGuessTimer(room, io) {
  if (room.pickTimer) { clearInterval(room.pickTimer); room.pickTimer = null; }
  room.guessTimeLeft = gm.GUESS_DURATION;
  io.to(room.code).emit('guess-phase-start', { timeLeft: gm.GUESS_DURATION });

  room.timer = setInterval(() => {
    room.guessTimeLeft--;
    io.to(room.code).emit('timer-tick', { timeLeft: room.guessTimeLeft });

    if (room.guessTimeLeft <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      gm.endRound(room);
      gm.resetAllStreaks(room);
      io.to(room.code).emit('round-end', {
        reason: 'timeout',
        topic: room.currentTopic.topic
      });
      setTimeout(() => sendScores(room, io), 1500);
    }
  }, 1000);
}

function sendScores(room, io) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const isLastRound = gm.shouldGameEnd(room);
  io.to(room.code).emit('show-scores', {
    players: sorted.map(p => ({ name: p.name, score: p.score, streak: p.streak || 0 })),
    roundNumber: room.currentRound,
    isLastRound,
  });
  room.state = 'scoring';

  if (isLastRound) {
    const roomCode = room.code;
    setTimeout(() => {
      const r = gm.getRoom(roomCode);
      if (!r) return;
      const sortedFinal = [...r.players].sort((a, b) => b.score - a.score);
      io.to(roomCode).emit('game-end', {
        players: sortedFinal.map(p => ({ name: p.name, score: p.score }))
      });
      gm.deleteRoom(roomCode);
    }, 5000);
  }
}

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BlatherBox running at http://localhost:${PORT}`);
  console.log(`Admin password: ${process.env.ADMIN_PASSWORD || 'blatheradmin'}`);
});
