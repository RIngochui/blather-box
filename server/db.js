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
    aliases TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    submitted_by TEXT NOT NULL DEFAULT 'anonymous',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migrate: drop clues column, add aliases column if needed
const columns = db.prepare('PRAGMA table_info(topics)').all();
const colNames = columns.map(c => c.name);

if (colNames.includes('clues')) {
  const hasAliases = colNames.includes('aliases');
  db.exec(`
    CREATE TABLE topics_migrated (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      category TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_by TEXT NOT NULL DEFAULT 'anonymous',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO topics_migrated (id, topic, category, status, submitted_by, created_at)
      SELECT id, topic, category, status, submitted_by, created_at FROM topics;
    DROP TABLE topics;
    ALTER TABLE topics_migrated RENAME TO topics;
  `);
  console.log('Migrated topics table: removed clues, added aliases.');
} else if (!colNames.includes('aliases')) {
  db.exec(`ALTER TABLE topics ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]'`);
  console.log('Migrated topics table: added aliases column.');
}

// Seed data
const seedTopics = [
  // Things
  { topic: 'Umbrella',         aliases: [],                          category: 'Thing'      },
  { topic: 'Escalator',        aliases: [],                          category: 'Thing'      },
  { topic: 'Vending Machine',  aliases: [],                          category: 'Thing'      },
  { topic: 'Magnifying Glass', aliases: [],                          category: 'Thing'      },
  { topic: 'Submarine',        aliases: ['sub'],                     category: 'Thing'      },
  { topic: 'Trampoline',       aliases: [],                          category: 'Thing'      },
  { topic: 'Speedometer',      aliases: [],                          category: 'Thing'      },
  { topic: 'Accordion',        aliases: [],                          category: 'Thing'      },
  { topic: 'Sundial',          aliases: [],                          category: 'Thing'      },
  { topic: 'Lava Lamp',        aliases: [],                          category: 'Thing'      },
  // Places
  { topic: 'Lighthouse',       aliases: [],                          category: 'Place'      },
  { topic: 'Tokyo',            aliases: [],                          category: 'Place'      },
  { topic: 'The Bermuda Triangle', aliases: ['Bermuda Triangle'],    category: 'Place'      },
  { topic: 'The Vatican',      aliases: ['Vatican'],                 category: 'Place'      },
  { topic: 'Las Vegas',        aliases: ['Vegas'],                   category: 'Place'      },
  { topic: 'Antarctica',       aliases: [],                          category: 'Place'      },
  { topic: 'The Great Wall of China', aliases: ['Great Wall'],       category: 'Place'      },
  { topic: 'Stonehenge',       aliases: [],                          category: 'Place'      },
  { topic: 'The Amazon Rainforest', aliases: ['Amazon'],             category: 'Place'      },
  { topic: 'Area 51',          aliases: [],                          category: 'Place'      },
  // Persons
  { topic: 'Albert Einstein',  aliases: ['Einstein'],                category: 'Person'     },
  { topic: 'Frida Kahlo',      aliases: ['Kahlo'],                   category: 'Person'     },
  { topic: 'Elon Musk',        aliases: ['Musk'],                    category: 'Person'     },
  { topic: 'Cleopatra',        aliases: [],                          category: 'Person'     },
  { topic: 'Adolf Hitler',     aliases: ['Hitler'],                  category: 'Person'     },
  { topic: 'Nikola Tesla',     aliases: ['Tesla'],                   category: 'Person'     },
  { topic: 'Leonardo da Vinci',aliases: ['da Vinci', 'DaVinci'],     category: 'Person'     },
  { topic: 'Marie Curie',      aliases: ['Curie'],                   category: 'Person'     },
  { topic: 'Genghis Khan',     aliases: ['Khan'],                    category: 'Person'     },
  { topic: 'Oprah Winfrey',    aliases: ['Oprah'],                   category: 'Person'     },
  // Food/Drink
  { topic: 'Sushi',            aliases: [],                          category: 'Food/Drink' },
  { topic: 'Espresso',         aliases: [],                          category: 'Food/Drink' },
  { topic: 'Kimchi',           aliases: [],                          category: 'Food/Drink' },
  { topic: 'Croissant',        aliases: [],                          category: 'Food/Drink' },
  { topic: 'Bubble Tea',       aliases: ['Boba', 'Boba Tea'],        category: 'Food/Drink' },
  { topic: 'Sriracha',         aliases: ['Rooster Sauce'],           category: 'Food/Drink' },
  { topic: 'Tiramisu',         aliases: [],                          category: 'Food/Drink' },
  { topic: 'Ramen',            aliases: [],                          category: 'Food/Drink' },
  { topic: 'Pretzel',          aliases: [],                          category: 'Food/Drink' },
  { topic: 'Cotton Candy',     aliases: ['Candy Floss'],             category: 'Food/Drink' },
  // Activities
  { topic: 'Rock Climbing',    aliases: ['Climbing'],                category: 'Activity'   },
  { topic: 'Scuba Diving',     aliases: ['Diving', 'Scuba'],         category: 'Activity'   },
  { topic: 'Origami',          aliases: [],                          category: 'Activity'   },
  { topic: 'Parkour',          aliases: ['Freerunning'],             category: 'Activity'   },
  { topic: 'Knitting',         aliases: [],                          category: 'Activity'   },
  { topic: 'Escape Room',      aliases: [],                          category: 'Activity'   },
  { topic: 'Hot Air Ballooning', aliases: ['Hot Air Balloon'],       category: 'Activity'   },
  { topic: 'Bungee Jumping',   aliases: ['Bungee'],                  category: 'Activity'   },
  // Movies/Shows
  { topic: 'Jurassic Park',    aliases: ['JP'],                      category: 'Movie/Show' },
  { topic: 'Breaking Bad',     aliases: ['BB'],                      category: 'Movie/Show' },
  { topic: 'The Lion King',    aliases: ['Lion King'],               category: 'Movie/Show' },
  { topic: 'Titanic',          aliases: [],                          category: 'Movie/Show' },
  { topic: 'The Office',       aliases: [],                          category: 'Movie/Show' },
  { topic: 'Inception',        aliases: [],                          category: 'Movie/Show' },
  { topic: 'Stranger Things',  aliases: ['ST'],                      category: 'Movie/Show' },
  { topic: 'Fate Grand Order', aliases: ['FGO'],                     category: 'Movie/Show' },
  { topic: 'Squid Game',       aliases: [],                          category: 'Movie/Show' },
  { topic: 'The Matrix',       aliases: ['Matrix'],                  category: 'Movie/Show' },
];

// Insert seed topics that don't exist yet (by topic name, case-insensitive)
const existingTopics = db.prepare('SELECT LOWER(topic) as t FROM topics').all().map(r => r.t);
const toInsert = seedTopics.filter(s => !existingTopics.includes(s.topic.toLowerCase()));
if (toInsert.length > 0) {
  const insertStmt = db.prepare(`
    INSERT INTO topics (topic, category, aliases, submitted_by, status)
    VALUES (@topic, @category, @aliases, 'admin', 'approved')
  `);
  const insertMany = db.transaction((topics) => {
    for (const t of topics) {
      insertStmt.run({ ...t, aliases: JSON.stringify(t.aliases) });
    }
  });
  insertMany(toInsert);
  console.log(`Seeded ${toInsert.length} new topics.`);
}

// Topic queries
const topicQueries = {
  getAll:      db.prepare('SELECT * FROM topics ORDER BY created_at DESC'),
  getByStatus: db.prepare('SELECT * FROM topics WHERE status = ? ORDER BY created_at DESC'),
  getById:     db.prepare('SELECT * FROM topics WHERE id = ?'),
  getApproved: db.prepare("SELECT * FROM topics WHERE status = 'approved'"),

  insert: db.prepare(`
    INSERT INTO topics (topic, category, aliases, submitted_by)
    VALUES (@topic, @category, @aliases, @submitted_by)
  `),

  updateStatus: db.prepare('UPDATE topics SET status = ? WHERE id = ?'),

  update: db.prepare(`
    UPDATE topics SET topic = @topic, category = @category, aliases = @aliases WHERE id = @id
  `),

  delete: db.prepare('DELETE FROM topics WHERE id = ?'),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
    FROM topics
  `)
};

module.exports = { db, topicQueries };
