import db, { usePostgres } from '../database/db.js';
import { messageStorePostgres } from '../database/messageStorePostgres.js';

const feedbackStore = usePostgres ? {
  async saveResponseFeedback(responseId, userId, feedbackType, feedbackValue, confidenceImpact = 0) {
    const query = `
      INSERT INTO response_feedback 
      (response_id, user_id, feedback_type, feedback_value, confidence_impact)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;
    
    const values = [responseId, userId, feedbackType, feedbackValue, confidenceImpact];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  async getFeedbackForResponse(responseId) {
    const query = `
      SELECT * FROM response_feedback 
      WHERE response_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [responseId]);
    return result.rows;
  },

  async getFeedbackPatterns(limit = 100) {
    const query = `
      SELECT 
        feedback_type,
        feedback_value,
        COUNT(*) as frequency,
        AVG(confidence_impact) as avg_impact
      FROM response_feedback 
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY feedback_type, feedback_value
      ORDER BY frequency DESC
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
    return result.rows;
  }
} : {
  // SQLite fallback (simplified)
  async saveResponseFeedback(responseId, userId, feedbackType, feedbackValue, confidenceImpact = 0) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO response_feedback 
        (response_id, user_id, feedback_type, feedback_value, confidence_impact)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(responseId, userId, feedbackType, feedbackValue, confidenceImpact, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, created_at: new Date().toISOString() });
      });
    });
  },

  async getFeedbackForResponse(responseId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM response_feedback 
         WHERE response_id = ? 
         ORDER BY created_at DESC`,
        [responseId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  async getFeedbackPatterns(limit = 100) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          feedback_type,
          feedback_value,
          COUNT(*) as frequency,
          AVG(confidence_impact) as avg_impact
        FROM response_feedback 
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY feedback_type, feedback_value
        ORDER BY frequency DESC
        LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
};

export { feedbackStore };
