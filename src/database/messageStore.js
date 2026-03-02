import db, { usePostgres } from './db.js';
import { messageStorePostgres } from './messageStorePostgres.js';

const messageStore = usePostgres ? messageStorePostgres : {
  saveMessage(message) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO messages 
        (id, user_id, channel_id, text, timestamp, thread_ts, is_user_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        message.ts || message.client_msg_id,
        message.user,
        message.channel,
        message.text,
        message.ts,
        message.thread_ts || null,
        message.is_user_message ? 1 : 0,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );

      stmt.finalize();
    });
  },

  getUserMessages(userId, limit = 1000) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM messages 
         WHERE user_id = ? AND is_user_message = 1 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  getChannelMessages(channelId, limit = 100) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM messages 
         WHERE channel_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [channelId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  getContextMessages(channelId, beforeTimestamp, limit = 20) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM messages 
         WHERE channel_id = ? AND timestamp < ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [channelId, beforeTimestamp, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows ? rows.reverse() : []);
        }
      );
    });
  },

  saveTeamMember(member) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO team_members 
        (user_id, username, real_name, display_name, message_count, last_seen)
        VALUES (?, ?, ?, ?, 
          COALESCE((SELECT message_count FROM team_members WHERE user_id = ?), 0) + 1,
          CURRENT_TIMESTAMP)
      `);

      stmt.run(
        member.id,
        member.name,
        member.real_name,
        member.profile?.display_name || member.name,
        member.id,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );

      stmt.finalize();
    });
  },

  getTeamMembers() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM team_members ORDER BY message_count DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  savePersonalityProfile(profile) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM personality_profile');
      
      const stmt = db.prepare(`
        INSERT INTO personality_profile 
        (avg_message_length, common_phrases, tone_indicators, emoji_patterns, 
         greeting_patterns, closing_patterns, vocabulary_frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        profile.avgMessageLength,
        JSON.stringify(profile.commonPhrases),
        JSON.stringify(profile.toneIndicators),
        JSON.stringify(profile.emojiPatterns),
        JSON.stringify(profile.greetingPatterns),
        JSON.stringify(profile.closingPatterns),
        JSON.stringify(profile.vocabularyFrequency),
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );

      stmt.finalize();
    });
  },

  getPersonalityProfile() {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM personality_profile ORDER BY id DESC LIMIT 1',
        (err, row) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else {
            resolve({
              avgMessageLength: row.avg_message_length,
              commonPhrases: JSON.parse(row.common_phrases || '[]'),
              toneIndicators: JSON.parse(row.tone_indicators || '{}'),
              emojiPatterns: JSON.parse(row.emoji_patterns || '[]'),
              greetingPatterns: JSON.parse(row.greeting_patterns || '[]'),
              closingPatterns: JSON.parse(row.closing_patterns || '[]'),
              vocabularyFrequency: JSON.parse(row.vocabulary_frequency || '{}'),
            });
          }
        }
      );
    });
  },

  logResponse(log) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO response_log 
        (message_id, channel_id, context, generated_response, confidence_score, auto_sent, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        log.messageId,
        log.channelId,
        JSON.stringify(log.context),
        log.generatedResponse,
        log.confidenceScore,
        log.autoSent ? 1 : 0,
        log.sentAt || null,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );

      stmt.finalize();
    });
  },

  getResponseLogs(limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM response_log 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },
};

export { messageStore };
