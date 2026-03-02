import db from './db.js';

export const messageStorePostgres = {
  async saveMessage(message) {
    const query = `
      INSERT INTO messages 
      (id, user_id, channel_id, text, timestamp, thread_ts, is_user_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        is_user_message = EXCLUDED.is_user_message
    `;

    const values = [
      message.ts || message.client_msg_id,
      message.user,
      message.channel,
      message.text,
      message.ts,
      message.thread_ts || null,
      message.is_user_message ? 1 : 0,
    ];

    await db.query(query, values);
  },

  async getUserMessages(userId, limit = 1000) {
    const query = `
      SELECT * FROM messages 
      WHERE user_id = $1 AND is_user_message = 1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  },

  async getChannelMessages(channelId, limit = 100) {
    const query = `
      SELECT * FROM messages 
      WHERE channel_id = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [channelId, limit]);
    return result.rows;
  },

  async getContextMessages(channelId, beforeTimestamp, limit = 20) {
    const query = `
      SELECT * FROM messages 
      WHERE channel_id = $1 AND timestamp < $2 
      ORDER BY timestamp DESC 
      LIMIT $3
    `;
    
    const result = await db.query(query, [channelId, beforeTimestamp, limit]);
    return result.rows.reverse();
  },

  async saveTeamMember(member) {
    const query = `
      INSERT INTO team_members 
      (user_id, username, real_name, display_name, message_count, last_seen)
      VALUES ($1, $2, $3, $4, 
        COALESCE((SELECT message_count FROM team_members WHERE user_id = $1), 0) + 1,
        CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        real_name = EXCLUDED.real_name,
        display_name = EXCLUDED.display_name,
        message_count = team_members.message_count + 1,
        last_seen = CURRENT_TIMESTAMP
    `;

    const values = [
      member.id,
      member.name,
      member.real_name,
      member.profile?.display_name || member.name,
    ];

    await db.query(query, values);
  },

  async getTeamMembers() {
    const query = 'SELECT * FROM team_members ORDER BY message_count DESC';
    const result = await db.query(query);
    return result.rows;
  },

  async savePersonalityProfile(profile) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM personality_profile');
      
      const query = `
        INSERT INTO personality_profile 
        (avg_message_length, common_phrases, tone_indicators, emoji_patterns, 
         greeting_patterns, closing_patterns, vocabulary_frequency)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        profile.avgMessageLength,
        JSON.stringify(profile.commonPhrases),
        JSON.stringify(profile.toneIndicators),
        JSON.stringify(profile.emojiPatterns),
        JSON.stringify(profile.greetingPatterns),
        JSON.stringify(profile.closingPatterns),
        JSON.stringify(profile.vocabularyFrequency),
      ];

      await client.query(query, values);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getPersonalityProfile() {
    const query = 'SELECT * FROM personality_profile ORDER BY id DESC LIMIT 1';
    const result = await db.query(query);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      avgMessageLength: row.avg_message_length,
      commonPhrases: JSON.parse(row.common_phrases || '[]'),
      toneIndicators: JSON.parse(row.tone_indicators || '{}'),
      emojiPatterns: JSON.parse(row.emoji_patterns || '[]'),
      greetingPatterns: JSON.parse(row.greeting_patterns || '[]'),
      closingPatterns: JSON.parse(row.closing_patterns || '[]'),
      vocabularyFrequency: JSON.parse(row.vocabulary_frequency || '{}'),
    };
  },

  async logResponse(log) {
    const query = `
      INSERT INTO response_log 
      (message_id, channel_id, context, generated_response, confidence_score, auto_sent, sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      log.messageId,
      log.channelId,
      JSON.stringify(log.context),
      log.generatedResponse,
      log.confidenceScore,
      log.autoSent ? 1 : 0,
      log.sentAt || null,
    ];

    await db.query(query, values);
  },

  async getResponseLogs(limit = 50) {
    const query = `
      SELECT * FROM response_log 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
    return result.rows;
  },
};
