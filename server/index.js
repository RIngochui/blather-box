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
app.use('/api/submit', require('./routes/submit').router);
app.use('/api/game', require('./routes/game'));

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
    // Tell everyone in the room (including host) about the updated player list
    io.to(upperCode).emit('player-joined', {
      players: result.room.players.map(p => ({ name: p.name, score: p.score })),
      newPlayer: result.player.name
    });
    console.log(`${name} joined room ${upperCode}`);
  });

  // HOST: Start the game
  socket.on('start-game', () => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('game-error', { message: 'Need at least 2 players to start.' });
      return;
    }
    beginRound(room, io);
  });

  // HOST/DESCRIBER: Advance to next clue
  socket.on('next-clue', () => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.state !== 'round') return;
    // Only host or describer can advance clues
    if (socket.id !== room.hostSocketId && socket.id !== room.describerId) return;

    const clue = gm.nextClue(room);
    if (clue) {
      io.to(room.code).emit('clue-revealed', {
        clueIndex: room.currentClueIndex,
        clue: { starter: clue.starter, response: clue.response }
      });
    } else {
      // No more clues — time still ticking
      io.to(room.code).emit('no-more-clues');
    }
  });

  // PLAYER: Submit a guess
  socket.on('submit-guess', ({ guess }) => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.state !== 'round') return;
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
        describerName: result.describer ? result.describer.name : ''
      });

      setTimeout(() => sendScores(room, io), 1500);
    } else {
      // Wrong — notify only the guesser
      socket.emit('wrong-guess', { guess });
    }
  });

  // HOST: Start next round
  socket.on('next-round', () => {
    const room = gm.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    beginRound(room, io);
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

function beginRound(room, io) {
  if (room.timer) clearInterval(room.timer);

  const result = gm.startRound(room);
  if (result.error) {
    io.to(room.code).emit('game-error', { message: result.error });
    return;
  }

  const { topic, describer, activeClues, category } = result;
  const firstClue = activeClues[0];

  // Send describer their private info
  io.to(describer.socketId).emit('round-start', {
    role: 'describer',
    topic: topic.topic,
    category,
    clues: activeClues,
    currentClueIndex: 0
  });

  // Send guessers their info (no topic)
  for (const player of room.players) {
    if (player.socketId !== describer.socketId) {
      io.to(player.socketId).emit('round-start', {
        role: 'guesser',
        category,
        describerName: describer.name,
        currentClueIndex: 0
      });
    }
  }

  // Tell host full info
  io.to(room.hostSocketId).emit('round-start', {
    role: 'host',
    topic: topic.topic,
    category,
    describerName: describer.name,
    clue: firstClue ? { starter: firstClue.starter, response: firstClue.response } : null,
    clueIndex: 0,
    totalClues: activeClues.length,
    roundNumber: room.currentRound
  });

  // Broadcast first clue to room
  if (firstClue) {
    io.to(room.code).emit('clue-revealed', {
      clueIndex: 0,
      clue: { starter: firstClue.starter, response: firstClue.response }
    });
  }

  // Start countdown timer
  room.timeLeft = gm.ROUND_DURATION;
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit('timer-tick', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      gm.endRound(room);
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
  io.to(room.code).emit('show-scores', {
    players: sorted.map(p => ({ name: p.name, score: p.score })),
    roundNumber: room.currentRound
  });
  room.state = 'scoring';
}

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BlatherBox running at http://localhost:${PORT}`);
  console.log(`Admin password: ${process.env.ADMIN_PASSWORD || 'blatheradmin'}`);
});
