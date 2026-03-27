const express = require('express');
const router = express.Router();
const { topicQueries, parseTopicClues } = require('../db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'blatheradmin';

// Simple session-style auth via cookie flag (lightweight, no deps)
function isAuthenticated(req) {
  return req.headers['x-admin-auth'] === ADMIN_PASSWORD ||
         req.query.auth === ADMIN_PASSWORD;
}

// Auth check middleware
function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Verify password
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// Get all topics (with optional status filter)
router.get('/topics', requireAuth, (req, res) => {
  const { status } = req.query;
  let topics;
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    topics = topicQueries.getByStatus.all(status).map(parseTopicClues);
  } else {
    topics = topicQueries.getAll.all().map(parseTopicClues);
  }
  res.json(topics);
});

// Get stats
router.get('/stats', requireAuth, (req, res) => {
  const stats = topicQueries.getStats.get();
  res.json(stats);
});

// Update status of a single topic
router.patch('/topics/:id/status', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  topicQueries.updateStatus.run(status, id);
  res.json({ success: true });
});

// Bulk status update
router.patch('/topics/bulk-status', requireAuth, (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const updateMany = require('../db').db.transaction(() => {
    for (const id of ids) {
      topicQueries.updateStatus.run(status, id);
    }
  });
  updateMany();
  res.json({ success: true, updated: ids.length });
});

// Edit a topic
router.put('/topics/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { topic, category, clues } = req.body;
  if (!topic || !category || !Array.isArray(clues)) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  topicQueries.update.run({ id, topic, category, clues: JSON.stringify(clues) });
  res.json({ success: true });
});

// Delete a topic
router.delete('/topics/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  topicQueries.delete.run(id);
  res.json({ success: true });
});

module.exports = router;
