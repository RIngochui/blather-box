const express = require('express');
const router = express.Router();
const { topicQueries } = require('../db');

// Returns clue templates for the frontend (used by submit form too)
router.get('/clue-templates', (req, res) => {
  const { CLUE_TEMPLATES } = require('./submit');
  res.json(CLUE_TEMPLATES);
});

module.exports = router;
