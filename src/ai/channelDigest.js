import OpenAI from 'openai';
import db from '../database/postgres.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const channelDigest = {
  async generateAndSaveDigest(channelId, date, slackClient = null) {
    try {
      console.log(`📰 Generating channel digest for ${channelId} on ${date}...`);

      const query = `
        SELECT user_id, text, timestamp
        FROM messages
        WHERE channel_id = $1
          AND DATE(to_timestamp(timestamp::double precision)) = $2
          AND text IS NOT NULL
          AND text != ''
        ORDER BY timestamp ASC
      `;
      const result = await db.query(query, [channelId, date]);
      const messages = result.rows;

      if (messages.length === 0) {
        console.log(`📰 No messages found for digest: channel=${channelId} date=${date}`);
        return null;
      }

      console.log(`📰 Analyzing ${messages.length} messages for digest...`);

      const messageTexts = messages
        .map(m => `[${m.user_id}]: ${m.text}`)
        .join('\n');

      const prompt = `You are analyzing Slack channel messages from a software development team. Extract structured insights.

Messages from ${date}:
${messageTexts}

Provide a structured JSON analysis with:
- topics: array of key topics discussed (strings)
- decisions: array of decisions or conclusions made (strings, empty array if none)
- open_questions: array of unresolved questions or pending items (strings, empty array if none)
- per_person: object mapping user_id to a 1-sentence summary of their contributions
- raw_summary: 2-3 sentence overall summary of the day's discussion

Format as valid JSON only, no markdown:
{
  "topics": [],
  "decisions": [],
  "open_questions": [],
  "per_person": {},
  "raw_summary": ""
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a technical project manager extracting structured insights from team communications. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      let analysis;
      try {
        const content = response.choices[0].message.content.trim();
        analysis = JSON.parse(content);
      } catch (parseErr) {
        console.error('📰 Failed to parse digest JSON, using fallback:', parseErr.message);
        analysis = {
          topics: [],
          decisions: [],
          open_questions: [],
          per_person: {},
          raw_summary: `${messages.length} messages exchanged in channel on ${date}.`
        };
      }

      await db.query(
        `INSERT INTO channel_digests
           (channel_id, digest_date, topics, decisions, open_questions, per_person, raw_summary, message_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (channel_id, digest_date) DO UPDATE SET
           topics = EXCLUDED.topics,
           decisions = EXCLUDED.decisions,
           open_questions = EXCLUDED.open_questions,
           per_person = EXCLUDED.per_person,
           raw_summary = EXCLUDED.raw_summary,
           message_count = EXCLUDED.message_count`,
        [
          channelId,
          date,
          JSON.stringify(analysis.topics || []),
          JSON.stringify(analysis.decisions || []),
          JSON.stringify(analysis.open_questions || []),
          JSON.stringify(analysis.per_person || {}),
          analysis.raw_summary || '',
          messages.length,
        ]
      );

      console.log(`✅ Channel digest saved for ${channelId} on ${date}`);
      return analysis;
    } catch (error) {
      console.error('❌ Error generating channel digest:', error);
      return null;
    }
  },

  async getRecentDigests(channelId, days = 3) {
    try {
      const result = await db.query(
        `SELECT digest_date, topics, decisions, open_questions, per_person, raw_summary, message_count
         FROM channel_digests
         WHERE channel_id = $1
           AND digest_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
         ORDER BY digest_date DESC`,
        [channelId]
      );

      return result.rows.map(row => ({
        date: row.digest_date,
        topics: this._safeParse(row.topics, []),
        decisions: this._safeParse(row.decisions, []),
        open_questions: this._safeParse(row.open_questions, []),
        per_person: this._safeParse(row.per_person, {}),
        raw_summary: row.raw_summary || '',
        message_count: row.message_count,
      }));
    } catch (error) {
      console.error('❌ Error fetching recent digests:', error);
      return [];
    }
  },

  buildContextString(digests) {
    if (!digests || digests.length === 0) {
      return '';
    }

    const lines = ['## Recent Channel Context (last 3 days — do NOT repeat these resolved topics)'];

    for (const digest of digests) {
      lines.push(`\n### ${digest.date}`);
      lines.push(`Summary: ${digest.raw_summary}`);

      if (digest.topics.length > 0) {
        lines.push(`Topics discussed: ${digest.topics.join(', ')}`);
      }
      if (digest.decisions.length > 0) {
        lines.push(`Decisions made: ${digest.decisions.join('; ')}`);
      }
      if (digest.open_questions.length > 0) {
        lines.push(`Still open/unresolved: ${digest.open_questions.join('; ')}`);
      }
    }

    lines.push('\nDo NOT re-raise points already resolved. Do NOT repeat follow-up questions already asked.');

    return lines.join('\n');
  },

  _safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
};
