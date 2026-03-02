import pool from './postgres.js';

async function initializeDatabase() {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized');
  }

  let retries = 5;
  let client;
  
  while (retries > 0) {
    try {
      client = await pool.connect();
      break;
    } catch (err) {
      retries--;
      console.log(`Database connection attempt failed. Retries left: ${retries}`);
      if (retries === 0) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        text TEXT,
        timestamp TEXT NOT NULL,
        thread_ts TEXT,
        is_user_message INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        real_name TEXT,
        display_name TEXT,
        message_count INTEGER DEFAULT 0,
        last_seen TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS personality_profile (
        id SERIAL PRIMARY KEY,
        avg_message_length REAL,
        common_phrases TEXT,
        tone_indicators TEXT,
        emoji_patterns TEXT,
        greeting_patterns TEXT,
        closing_patterns TEXT,
        vocabulary_frequency TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS response_log (
        id SERIAL PRIMARY KEY,
        message_id TEXT,
        channel_id TEXT,
        context TEXT,
        generated_response TEXT,
        confidence_score REAL,
        auto_sent INTEGER DEFAULT 0,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `);

    console.log('PostgreSQL database initialized successfully');
  } finally {
    client.release();
  }
}

export { pool, initializeDatabase };
