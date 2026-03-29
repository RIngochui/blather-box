const express = require('express');
const router = express.Router();
const { topicQueries } = require('../db');

const CATEGORIES = ['Thing', 'Person', 'Place', 'Food/Drink', 'Activity', 'Movie/Show'];

router.post('/', (req, res) => {
  const { topic, category, submitted_by, aliases } = req.body;

  if (!topic || !topic.trim()) return res.status(400).json({ error: 'Topic is required' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });

  // aliases is an optional array of strings
  const cleanAliases = Array.isArray(aliases)
    ? aliases.map(a => String(a).trim()).filter(Boolean)
    : [];

  const name = (submitted_by && submitted_by.trim()) ? submitted_by.trim() : 'anonymous';
  if (name.toLowerCase() === 'admin') {
    return res.status(400).json({ error: '"admin" is a reserved name. Please use a different name.' });
  }

  topicQueries.insert.run({
    topic: topic.trim(),
    category,
    aliases: JSON.stringify(cleanAliases),
    submitted_by: name
  });

  res.json({ success: true, message: 'Topic submitted! It will be reviewed before appearing in the game.' });
});

module.exports = router;
