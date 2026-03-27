const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'blatherbox.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    category TEXT NOT NULL,
    clues TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    submitted_by TEXT NOT NULL DEFAULT 'anonymous',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed data — 10 approved topics across all 6 categories
const seedTopics = [
  {
    topic: 'Umbrella',
    category: 'Thing',
    clues: [
      { starter: 'This thing is a type of', response: 'portable shelter', required: true },
      { starter: 'This thing can be found', response: 'near doorways or in bags on rainy days', required: true },
      { starter: 'This thing is used to', response: 'keep you dry from rain or shield from sun', required: true },
      { starter: 'This thing is known for', response: 'folding open with a press of a button', required: false },
      { starter: 'You might see this thing', response: 'at bus stops or in lost-and-found bins', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Lighthouse',
    category: 'Place',
    clues: [
      { starter: 'This place is a type of', response: 'tower or navigational structure', required: true },
      { starter: 'This place can be found', response: 'on rocky coastlines or harbour entrances', required: true },
      { starter: 'This place is known for', response: 'emitting a rotating beam of light visible at sea', required: true },
      { starter: 'People go to this place to', response: 'guide ships safely away from hazards', required: false },
      { starter: 'This place is associated with', response: 'isolation, keepers, and foghorns', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Albert Einstein',
    category: 'Person',
    clues: [
      { starter: 'This person is a', response: 'theoretical physicist and mathematician', required: true },
      { starter: 'This person is known for', response: 'developing the theory of relativity', required: true },
      { starter: 'This person lived/lives in', response: 'Germany and later the United States in the 20th century', required: true },
      { starter: 'This person is associated with', response: 'the equation E equals mc squared', required: false },
      { starter: 'You might recognize this person by', response: 'wild white hair and a bushy mustache', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Sushi',
    category: 'Food/Drink',
    clues: [
      { starter: 'This food/drink is a type of', response: 'Japanese dish', required: true },
      { starter: 'This food/drink is made with', response: 'vinegared rice, raw fish, and seaweed', required: true },
      { starter: 'This food/drink is often eaten/drunk', response: 'at Japanese restaurants or conveyor belt eateries', required: true },
      { starter: 'This food/drink tastes', response: 'fresh, slightly tangy, and savoury', required: false },
      { starter: 'This food/drink is associated with', response: 'chopsticks, soy sauce, and wasabi', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Rock Climbing',
    category: 'Activity',
    clues: [
      { starter: 'This activity involves', response: 'scaling vertical surfaces using hands and feet', required: true },
      { starter: 'This activity is done', response: 'on natural cliff faces or indoor climbing walls', required: true },
      { starter: 'People do this activity to', response: 'build strength, face fears, and reach the top', required: true },
      { starter: 'This activity requires', response: 'harnesses, ropes, chalk, and special shoes', required: false },
      { starter: 'This activity is associated with', response: 'bouldering, belaying, and carabiners', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Jurassic Park',
    category: 'Movie/Show',
    clues: [
      { starter: 'This movie/show is a type of', response: 'science fiction adventure thriller', required: true },
      { starter: 'This movie/show is about', response: 'a theme park where cloned dinosaurs escape and terrorize visitors', required: true },
      { starter: 'This movie/show features', response: 'a T-Rex chasing a jeep and raptors in a kitchen', required: true },
      { starter: 'This movie/show is known for', response: 'groundbreaking CGI dinosaur effects in the 1990s', required: false },
      { starter: 'You might recognize this movie/show by', response: 'the iconic logo of a T-Rex skeleton and the John Williams theme', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Escalator',
    category: 'Thing',
    clues: [
      { starter: 'This thing is a type of', response: 'moving staircase', required: true },
      { starter: 'This thing can be found', response: 'in shopping malls, airports, and subway stations', required: true },
      { starter: 'This thing is used to', response: 'carry people between floors without effort', required: true },
      { starter: 'This thing is known for', response: 'having a handrail that moves alongside the steps', required: false },
      { starter: 'You might see this thing', response: 'at the entrance of department stores or transit hubs', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Tokyo',
    category: 'Place',
    clues: [
      { starter: 'This place is a type of', response: 'major metropolitan city and capital', required: true },
      { starter: 'This place can be found', response: 'on the eastern coast of Honshu island in Japan', required: true },
      { starter: 'This place is known for', response: 'neon lights, bullet trains, and dense population', required: true },
      { starter: 'People go to this place to', response: 'experience anime culture, temples, and incredible food', required: false },
      { starter: 'This place is associated with', response: 'Mount Fuji views, cherry blossoms, and Shibuya crossing', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Frida Kahlo',
    category: 'Person',
    clues: [
      { starter: 'This person is a', response: 'painter and artist', required: true },
      { starter: 'This person is known for', response: 'vivid self-portraits and surrealist artwork', required: true },
      { starter: 'This person lived/lives in', response: 'Mexico in the early 20th century', required: true },
      { starter: 'This person is associated with', response: 'pain, identity, post-colonialism, and folk art', required: false },
      { starter: 'You might recognize this person by', response: 'flower-adorned hair and a prominent unibrow in portraits', required: false }
    ],
    submitted_by: 'admin'
  },
  {
    topic: 'Espresso',
    category: 'Food/Drink',
    clues: [
      { starter: 'This food/drink is a type of', response: 'concentrated coffee beverage', required: true },
      { starter: 'This food/drink is made with', response: 'finely ground coffee beans forced through with pressurised hot water', required: true },
      { starter: 'This food/drink is often eaten/drunk', response: 'at cafes or as a morning pick-me-up', required: true },
      { starter: 'This food/drink tastes', response: 'intensely bitter and rich with a creamy foam on top', required: false },
      { starter: 'This food/drink is associated with', response: 'Italian coffee culture and the base of lattes and cappuccinos', required: false }
    ],
    submitted_by: 'admin'
  }
];

const countStmt = db.prepare('SELECT COUNT(*) as count FROM topics');
const { count } = countStmt.get();

if (count === 0) {
  const insertStmt = db.prepare(`
    INSERT INTO topics (topic, category, clues, status, submitted_by)
    VALUES (@topic, @category, @clues, 'approved', @submitted_by)
  `);
  const insertMany = db.transaction((topics) => {
    for (const t of topics) {
      insertStmt.run({ ...t, clues: JSON.stringify(t.clues) });
    }
  });
  insertMany(seedTopics);
  console.log('Seeded database with 10 approved topics.');
}

// Topic queries
const topicQueries = {
  getAll: db.prepare('SELECT * FROM topics ORDER BY created_at DESC'),
  getByStatus: db.prepare('SELECT * FROM topics WHERE status = ? ORDER BY created_at DESC'),
  getById: db.prepare('SELECT * FROM topics WHERE id = ?'),
  getApproved: db.prepare("SELECT * FROM topics WHERE status = 'approved'"),

  insert: db.prepare(`
    INSERT INTO topics (topic, category, clues, submitted_by)
    VALUES (@topic, @category, @clues, @submitted_by)
  `),

  updateStatus: db.prepare('UPDATE topics SET status = ? WHERE id = ?'),

  update: db.prepare(`
    UPDATE topics SET topic = @topic, category = @category, clues = @clues
    WHERE id = @id
  `),

  delete: db.prepare('DELETE FROM topics WHERE id = ?'),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
    FROM topics
  `)
};

function parseTopicClues(topic) {
  if (typeof topic.clues === 'string') {
    topic.clues = JSON.parse(topic.clues);
  }
  return topic;
}

module.exports = { db, topicQueries, parseTopicClues };
