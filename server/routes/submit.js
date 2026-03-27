const express = require('express');
const router = express.Router();
const { topicQueries } = require('../db');

const CATEGORIES = ['Thing', 'Person', 'Place', 'Food/Drink', 'Activity', 'Movie/Show'];

const CLUE_TEMPLATES = {
  'Thing': [
    { starter: 'This thing is a type of', required: true },
    { starter: 'This thing can be found', required: true },
    { starter: 'This thing is used to', required: true },
    { starter: 'This thing is known for', required: false },
    { starter: 'You might see this thing', required: false }
  ],
  'Person': [
    { starter: 'This person is a', required: true },
    { starter: 'This person is known for', required: true },
    { starter: 'This person lived/lives in', required: true },
    { starter: 'This person is associated with', required: false },
    { starter: 'You might recognize this person by', required: false }
  ],
  'Place': [
    { starter: 'This place is a type of', required: true },
    { starter: 'This place can be found', required: true },
    { starter: 'This place is known for', required: true },
    { starter: 'People go to this place to', required: false },
    { starter: 'This place is associated with', required: false }
  ],
  'Food/Drink': [
    { starter: 'This food/drink is a type of', required: true },
    { starter: 'This food/drink is made with', required: true },
    { starter: 'This food/drink is often eaten/drunk', required: true },
    { starter: 'This food/drink tastes', required: false },
    { starter: 'This food/drink is associated with', required: false }
  ],
  'Activity': [
    { starter: 'This activity involves', required: true },
    { starter: 'This activity is done', required: true },
    { starter: 'People do this activity to', required: true },
    { starter: 'This activity requires', required: false },
    { starter: 'This activity is associated with', required: false }
  ],
  'Movie/Show': [
    { starter: 'This movie/show is a type of', required: true },
    { starter: 'This movie/show is about', required: true },
    { starter: 'This movie/show features', required: true },
    { starter: 'This movie/show is known for', required: false },
    { starter: 'You might recognize this movie/show by', required: false }
  ]
};

router.post('/', (req, res) => {
  const { topic, category, submitted_by, clues } = req.body;

  if (!topic || !topic.trim()) return res.status(400).json({ error: 'Topic is required' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  if (!Array.isArray(clues)) return res.status(400).json({ error: 'Clues must be an array' });

  const templates = CLUE_TEMPLATES[category];
  if (!templates) return res.status(400).json({ error: 'Unknown category' });

  // Validate required clues
  const topicLower = topic.trim().toLowerCase();
  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    const clue = clues[i];
    if (tmpl.required && (!clue || !clue.response || !clue.response.trim())) {
      return res.status(400).json({ error: `Clue ${i + 1} is required` });
    }
    // Check topic word not in clue
    if (clue && clue.response) {
      const responseLower = clue.response.toLowerCase();
      if (responseLower.includes(topicLower)) {
        return res.status(400).json({ error: `Clue ${i + 1} contains the topic word — keep it a secret!` });
      }
    }
  }

  // Build clue objects
  const clueObjects = templates.map((tmpl, i) => ({
    starter: tmpl.starter,
    response: (clues[i] && clues[i].response) ? clues[i].response.trim() : '',
    required: tmpl.required
  }));

  const name = (submitted_by && submitted_by.trim()) ? submitted_by.trim() : 'anonymous';

  topicQueries.insert.run({
    topic: topic.trim(),
    category,
    clues: JSON.stringify(clueObjects),
    submitted_by: name
  });

  res.json({ success: true, message: 'Topic submitted! It will be reviewed before appearing in the game.' });
});

module.exports = { router, CLUE_TEMPLATES };
