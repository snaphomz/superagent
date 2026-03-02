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

  async getMessages(limit = 500) {
    const query = `
      SELECT * FROM messages 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
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
    const result = await db.query(
      `SELECT * FROM response_log 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  // Daily check-in methods
  async saveCheckin(checkinData) {
    const {
      date, userId, morningMessageTs, morningResponseAt, morningResponseText,
      planningDone, planningDetails, discussedWithLead, leadName,
      redditEngaged, redditDetails, tasksFinalized, taskDetails,
      responseComplete, responseSpecific, pingCount, lastPingAt,
      codePushReminderSentAt, codePushAcknowledgedAt, eodUpdateReceivedAt
    } = checkinData;

    await db.query(
      `INSERT INTO daily_checkins 
       (date, user_id, morning_message_ts, morning_response_at, morning_response_text,
        planning_done, planning_details, discussed_with_lead, lead_name,
        reddit_engaged, reddit_details, tasks_finalized, task_details,
        response_complete, response_specific, ping_count, last_ping_at,
        code_push_reminder_sent_at, code_push_acknowledged_at, eod_update_received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (date, user_id) 
       DO UPDATE SET
         morning_message_ts = COALESCE(EXCLUDED.morning_message_ts, daily_checkins.morning_message_ts),
         morning_response_at = COALESCE(EXCLUDED.morning_response_at, daily_checkins.morning_response_at),
         morning_response_text = COALESCE(EXCLUDED.morning_response_text, daily_checkins.morning_response_text),
         planning_done = COALESCE(EXCLUDED.planning_done, daily_checkins.planning_done),
         planning_details = COALESCE(EXCLUDED.planning_details, daily_checkins.planning_details),
         discussed_with_lead = COALESCE(EXCLUDED.discussed_with_lead, daily_checkins.discussed_with_lead),
         lead_name = COALESCE(EXCLUDED.lead_name, daily_checkins.lead_name),
         reddit_engaged = COALESCE(EXCLUDED.reddit_engaged, daily_checkins.reddit_engaged),
         reddit_details = COALESCE(EXCLUDED.reddit_details, daily_checkins.reddit_details),
         tasks_finalized = COALESCE(EXCLUDED.tasks_finalized, daily_checkins.tasks_finalized),
         task_details = COALESCE(EXCLUDED.task_details, daily_checkins.task_details),
         response_complete = COALESCE(EXCLUDED.response_complete, daily_checkins.response_complete),
         response_specific = COALESCE(EXCLUDED.response_specific, daily_checkins.response_specific),
         ping_count = COALESCE(EXCLUDED.ping_count, daily_checkins.ping_count),
         last_ping_at = COALESCE(EXCLUDED.last_ping_at, daily_checkins.last_ping_at),
         code_push_reminder_sent_at = COALESCE(EXCLUDED.code_push_reminder_sent_at, daily_checkins.code_push_reminder_sent_at),
         code_push_acknowledged_at = COALESCE(EXCLUDED.code_push_acknowledged_at, daily_checkins.code_push_acknowledged_at),
         eod_update_received_at = COALESCE(EXCLUDED.eod_update_received_at, daily_checkins.eod_update_received_at)`,
      [date, userId, morningMessageTs, morningResponseAt, morningResponseText,
       planningDone ? 1 : 0, planningDetails, discussedWithLead ? 1 : 0, leadName,
       redditEngaged ? 1 : 0, redditDetails, tasksFinalized ? 1 : 0, taskDetails,
       responseComplete ? 1 : 0, responseSpecific ? 1 : 0, pingCount || 0, lastPingAt,
       codePushReminderSentAt, codePushAcknowledgedAt, eodUpdateReceivedAt]
    );
  },

  async getCheckinByDate(date, userId) {
    const result = await db.query(
      `SELECT * FROM daily_checkins WHERE date = $1 AND user_id = $2`,
      [date, userId]
    );
    return result.rows[0] || null;
  },

  async getTodayCheckins(date) {
    const result = await db.query(
      `SELECT * FROM daily_checkins WHERE date = $1`,
      [date]
    );
    return result.rows;
  },

  async updateCheckinPing(date, userId, pingCount, lastPingAt) {
    await db.query(
      `UPDATE daily_checkins 
       SET ping_count = $3, last_ping_at = $4
       WHERE date = $1 AND user_id = $2`,
      [date, userId, pingCount, lastPingAt]
    );
  },

  async updateTeamMemberRole(userId, role, exemptFromCheckins, exemptFromEod) {
    await db.query(
      `UPDATE team_members 
       SET role = $2, exempt_from_checkins = $3, exempt_from_eod = $4
       WHERE user_id = $1`,
      [userId, role, exemptFromCheckins ? 1 : 0, exemptFromEod ? 1 : 0]
    );
  },

  async getTeamMembersByRole(role) {
    const result = await db.query(
      `SELECT * FROM team_members WHERE role = $1`,
      [role]
    );
    return result.rows;
  },

  async getNonExemptMembers() {
    const result = await db.query(
      `SELECT * FROM team_members WHERE exempt_from_checkins = 0`
    );
    return result.rows;
  },

  // OBI Team request tracking methods
  async createObiRequest(requestType, messageTs, messageText) {
    const result = await db.query(
      `INSERT INTO obi_team_requests (request_type, message_ts, message_text)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [requestType, messageTs, messageText]
    );
    return result.rows[0].id;
  },

  async updateObiRequestSummary(requestId, summaryMessageTs) {
    await db.query(
      `UPDATE obi_team_requests 
       SET summary_posted_at = CURRENT_TIMESTAMP, summary_message_ts = $2
       WHERE id = $1`,
      [requestId, summaryMessageTs]
    );
  },

  async trackObiResponse(requestId, userId, responseType) {
    const column = responseType === 'eric' ? 'eric_responded_at' : 'pavan_responded_at';
    await db.query(
      `UPDATE obi_team_requests 
       SET ${column} = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );
  },

  async getObiRequestByMessageTs(messageTs) {
    const result = await db.query(
      `SELECT * FROM obi_team_requests WHERE message_ts = $1`,
      [messageTs]
    );
    return result.rows[0] || null;
  },

  async getObiRequestBySummaryTs(summaryTs) {
    const result = await db.query(
      `SELECT * FROM obi_team_requests WHERE summary_message_ts = $1`,
      [summaryTs]
    );
    return result.rows[0] || null;
  },

  async getPendingObiResponses() {
    const result = await db.query(
      `SELECT * FROM obi_team_requests 
       WHERE (eric_responded_at IS NULL OR pavan_responded_at IS NULL)
       AND summary_posted_at IS NOT NULL
       ORDER BY created_at DESC`
    );
    return result.rows;
  },
};
