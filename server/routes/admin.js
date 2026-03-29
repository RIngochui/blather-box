const express = require('express');
const router = express.Router();
const { topicQueries } = require('../db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'blatheradmin';

function isAuthenticated(req) {
  return req.headers['x-admin-auth'] === ADMIN_PASSWORD ||
         req.query.auth === ADMIN_PASSWORD;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

router.get('/topics', requireAuth, (req, res) => {
  const { status } = req.query;
  let topics;
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    topics = topicQueries.getByStatus.all(status);
  } else {
    topics = topicQueries.getAll.all();
  }
  res.json(topics);
});

router.get('/stats', requireAuth, (req, res) => {
  res.json(topicQueries.getStats.get());
});

router.patch('/topics/:id/status', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  topicQueries.updateStatus.run(status, id);
  res.json({ success: true });
});

router.patch('/topics/bulk-status', requireAuth, (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const updateMany = require('../db').db.transaction(() => {
    for (const id of ids) topicQueries.updateStatus.run(status, id);
  });
  updateMany();
  res.json({ success: true, updated: ids.length });
});

router.put('/topics/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { topic, category, aliases } = req.body;
  if (!topic || !category) return res.status(400).json({ error: 'Missing fields' });
  const cleanAliases = Array.isArray(aliases)
    ? aliases.map(a => String(a).trim()).filter(Boolean)
    : [];
  topicQueries.update.run({ id, topic, category, aliases: JSON.stringify(cleanAliases) });
  res.json({ success: true });
});

router.delete('/topics/:id', requireAuth, (req, res) => {
  topicQueries.delete.run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
