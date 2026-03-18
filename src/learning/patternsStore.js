import db, { usePostgres } from '../database/db.js';

const patternsStore = usePostgres ? {
  async savePattern(patternType, patternKey, patternValue, successRate = 0) {
    const query = `
      INSERT INTO learned_patterns 
      (pattern_type, pattern_key, pattern_value, success_rate, usage_count)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (pattern_type, pattern_key) 
      DO UPDATE SET
        pattern_value = EXCLUDED.pattern_value,
        success_rate = (learned_patterns.success_rate * learned_patterns.usage_count + $4) / (learned_patterns.usage_count + 1),
        usage_count = learned_patterns.usage_count + 1,
        last_updated = CURRENT_TIMESTAMP
      RETURNING id, success_rate, usage_count
    `;
    
    const values = [patternType, patternKey, JSON.stringify(patternValue), successRate];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  async getPattern(patternType, patternKey) {
    const query = `
      SELECT * FROM learned_patterns 
      WHERE pattern_type = $1 AND pattern_key = $2
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT 1
    `;
    
    const result = await db.query(query, [patternType, patternKey]);
    return result.rows[0];
  },

  async getTopPatterns(patternType, limit = 10) {
    const query = `
      SELECT * FROM learned_patterns 
      WHERE pattern_type = $1 AND usage_count >= 3
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [patternType, limit]);
    return result.rows;
  },

  async updatePatternSuccess(patternId, success) {
    const query = `
      UPDATE learned_patterns 
      SET success_rate = (success_rate * usage_count + $1) / (usage_count + 1),
          usage_count = usage_count + 1,
          last_updated = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING success_rate, usage_count
    `;
    
    const result = await db.query(query, [success ? 1 : 0, patternId]);
    return result.rows[0];
  }
} : {
  // SQLite fallback
  async savePattern(patternType, patternKey, patternValue, successRate = 0) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO learned_patterns 
        (pattern_type, pattern_key, pattern_value, success_rate, usage_count, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(patternType, patternKey, JSON.stringify(patternValue), successRate, 1, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, success_rate: successRate, usage_count: 1 });
      });
    });
  },

  async getPattern(patternType, patternKey) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM learned_patterns 
         WHERE pattern_type = ? AND pattern_key = ?
         ORDER BY success_rate DESC, usage_count DESC
         LIMIT 1`,
        [patternType, patternKey],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  },

  async getTopPatterns(patternType, limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM learned_patterns 
         WHERE pattern_type = ? AND usage_count >= 3
         ORDER BY success_rate DESC, usage_count DESC
         LIMIT ?`,
        [patternType, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  async updatePatternSuccess(patternId, success) {
    return new Promise((resolve, reject) => {
      db.get(
        `UPDATE learned_patterns 
         SET success_rate = (success_rate * usage_count + ?) / (usage_count + 1),
             usage_count = usage_count + 1,
             last_updated = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING success_rate, usage_count`,
        [success ? 1 : 0, patternId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
};

export { patternsStore };
