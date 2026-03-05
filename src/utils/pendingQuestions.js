import db from '../database/postgres.js';

export const pendingQuestions = {
  // Save a bot question that's awaiting an answer from userId in a thread
  async saveQuestion({ channelId, threadTs, userId, botMessageTs, questionText, questionType }) {
    await db.query(
      `INSERT INTO pending_questions
         (channel_id, thread_ts, user_id, bot_message_ts, question_text, question_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [channelId, threadTs, userId, botMessageTs, questionText, questionType || 'general']
    );
    console.log(`📌 Saved pending question for ${userId} in thread ${threadTs}`);
  },

  // Get all unanswered questions for a user in a specific thread
  async getUnansweredForThread(threadTs, userId) {
    const result = await db.query(
      `SELECT * FROM pending_questions
       WHERE thread_ts = $1 AND user_id = $2 AND answered = 0
       ORDER BY created_at ASC`,
      [threadTs, userId]
    );
    return result.rows;
  },

  // Get all unanswered questions for a user across all threads (last 7 days)
  async getUnansweredForUser(userId) {
    const result = await db.query(
      `SELECT * FROM pending_questions
       WHERE user_id = $1 AND answered = 0
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows;
  },

  // Mark a question as answered with the answer text and timestamp
  async markAnswered(id, answerTs, answerText) {
    await db.query(
      `UPDATE pending_questions
       SET answered = 1, answer_ts = $2, answer_text = $3
       WHERE id = $1`,
      [id, answerTs, answerText]
    );
  },

  // Check if an incoming message addresses any pending questions in the same thread.
  // Returns matched questions if found, empty array otherwise.
  async detectAnswers(message) {
    try {
      if (!message.user || !message.text || !message.thread_ts) return [];

      const unanswered = await this.getUnansweredForThread(message.thread_ts, message.user);
      if (unanswered.length === 0) return [];

      const answerText = message.text.toLowerCase();
      const answered = [];

      for (const q of unanswered) {
        // Heuristic: a reply to a thread with >20 chars is likely addressing the question
        // More specific: check if key topic words from the question appear in the answer
        const questionWords = q.question_text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 4); // only meaningful words

        const topicWords = questionWords.slice(0, 8); // first 8 meaningful words
        const matchCount = topicWords.filter(w => answerText.includes(w)).length;
        const isSubstantive = message.text.trim().length > 20;

        // Consider it an answer if it's substantive and shares topic words,
        // or if it's a thread reply of decent length (they're likely responding)
        if (isSubstantive && (matchCount >= 2 || answerText.length > 60)) {
          await this.markAnswered(q.id, message.ts, message.text);
          answered.push(q);
          console.log(`✅ Pending question answered by ${message.user}: "${q.question_text.substring(0, 80)}"`);
        }
      }

      return answered;
    } catch (err) {
      console.error('⚠️ Error detecting answers to pending questions:', err.message);
      return [];
    }
  },
};
