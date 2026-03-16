import cron from 'node-cron';
import { openai, GPT_MODEL } from '../ai/openaiClient.js';
import db from '../database/postgres.js';
import { jibbleMonitor } from '../monitors/jibbleMonitor.js';
import { clickupClient } from '../integrations/clickupClient.js';
import { config } from '../config/slack.js';


// Access control — only these two users ever receive strike data
const ANTONY_ID = config.target.userId;
const PHANI_ID = 'U09KQK8V7ST';
const MANAGERS = [ANTONY_ID, PHANI_ID];

// Jibble name → Slack user_id mapping (mirrors clickupMonitor.js)
const JIBBLE_TO_SLACK = {
  'Deepthi D': 'U09MTRQ2JPQ',
  'Pavan B': 'U09QRQLTBPT',
  'eric': 'U09034VD8QG',
  'Vyshnavi': 'U09D1SBHZSL',
  'Pranati Manthena': 'U0A4X9T7W06',
  'Harish K': 'U09QRQKKUGH',
  'Sai Deepthi Molugari': 'U0A31RQN0M7',
};

// ClickUp username → Slack user_id (mirrors clickupMonitor.js)
const CLICKUP_TO_SLACK = {
  'Antony': 'U08UHMRV2ES',
  'Devarapalli Deepthi': 'U09MTRQ2JPQ',
  'Eric Samuel': 'U09034VD8QG',
  'Harish Kakaraparthi': 'U09QRQKKUGH',
  'Pavan Balla': 'U09QRQLTBPT',
  'Phani kumar': 'U09KQK8V7ST',
  'Pranati Manthena': 'U0A4X9T7W06',
  'Sai Deepthi Molugari': 'U0A31RQN0M7',
  'Vyshnavi Devi': 'U09D1SBHZSL',
};

// Reverse: Slack user_id → Jibble name
const SLACK_TO_JIBBLE = Object.fromEntries(
  Object.entries(JIBBLE_TO_SLACK).map(([jibble, slack]) => [slack, jibble])
);

// Reverse: Slack user_id → ClickUp username(s)
const SLACK_TO_CLICKUP = {};
for (const [cu, slack] of Object.entries(CLICKUP_TO_SLACK)) {
  if (!SLACK_TO_CLICKUP[slack]) SLACK_TO_CLICKUP[slack] = [];
  SLACK_TO_CLICKUP[slack].push(cu.toLowerCase());
}

let slackClient = null;
let strikeJob = null;

export const strikeEvaluator = {
  initialize(client) {
    slackClient = client;
    // 9:30 PM IST, Mon–Sat (1=Mon … 6=Sat)
    strikeJob = cron.schedule(
      '30 21 * * 1-6',
      async () => {
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const today = nowIST.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        console.log(`⚡ Strike evaluator running for ${today}...`);
        await this.evaluateDay(today);
      },
      { scheduled: true, timezone: config.scheduler.timezone }
    );
    console.log('⚡ Strike evaluator initialized (runs 9:30 PM IST Mon–Sat)');
  },

  // ─── Main entry point ───────────────────────────────────────────────────────

  async evaluateDay(date) {
    try {
      // Get all non-exempt team members, excluding managers (Antony, Phani)
      const result = await db.query(
        `SELECT user_id, display_name, real_name FROM team_members
         WHERE exempt_from_eod = 0
           AND user_id NOT IN ($1, $2)`,
        [ANTONY_ID, PHANI_ID]
      );
      const members = result.rows;

      if (members.length === 0) {
        console.log('⚡ No non-exempt members found for strike evaluation');
        return [];
      }

      const allStrikes = [];

      for (const member of members) {
        const strikes = await this.evaluateMember(member.user_id, date, member);
        allStrikes.push({ member, strikes });
      }

      // Roll up weekly summary
      const flagged = await this.rollupWeekly(date, members);

      // Notify managers if any members hit 3+ strikes this week
      if (flagged.length > 0) {
        await this.notifyManagers(flagged, date);
      }

      console.log(`✅ Strike evaluation complete for ${date}: ${allStrikes.reduce((s, m) => s + m.strikes.length, 0)} total strikes`);
      return allStrikes;
    } catch (error) {
      console.error('❌ Error in strikeEvaluator.evaluateDay:', error);
      return [];
    }
  },

  async evaluateMember(userId, date, memberInfo = {}) {
    const strikes = [];
    const name = memberInfo.display_name || memberInfo.real_name || userId;

    try {
      // Strike 1: No EOD update by evaluation time
      const eodResult = await db.query(
        `SELECT eod_update_received_at FROM daily_checkins WHERE date = $1 AND user_id = $2`,
        [date, userId]
      );
      const checkin = eodResult.rows[0];
      const hasEOD = checkin && checkin.eod_update_received_at;

      if (!hasEOD) {
        strikes.push({ type: 'no_eod', details: 'No EOD update submitted' });
        console.log(`⚡ ${name}: Strike - no_eod`);
      } else {
        // Strike 2: EOD quality — fetch the actual EOD message from the messages table
        const eodMsgResult = await db.query(
          `SELECT text FROM messages
           WHERE user_id = $1
             AND channel_id = $2
             AND DATE(to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata') = $3::date
             AND thread_ts IS NULL
             AND (
               text ILIKE '%purpose%' OR text ILIKE '%process%' OR text ILIKE '%payoff%'
               OR text ILIKE '%update:%' OR text ILIKE '%updates:%' OR text ILIKE '%eod%'
             )
             AND LENGTH(text) > 50
           ORDER BY timestamp DESC
           LIMIT 1`,
          [userId, config.target.channelId, date]
        );
        const eodText = eodMsgResult.rows[0]?.text;
        if (eodText) {
          const score = await this.scoreEODQuality(eodText);
          console.log(`⚡ ${name}: EOD quality score = ${score}/10`);
          if (score < 4) {
            strikes.push({ type: 'low_quality', details: `EOD quality score: ${score}/10` });
            console.log(`⚡ ${name}: Strike - low_quality (${score}/10)`);
          }
        }
      }

      // Strike 3: Worked < 8 hours (Jibble)
      const jibbleName = SLACK_TO_JIBBLE[userId];
      if (jibbleName) {
        const workSummary = await jibbleMonitor.getWorkHoursSummary(date);
        const userData = workSummary[jibbleName];
        if (userData) {
          const hours = parseFloat(userData.total_work_hours);
          if (hours < 8) {
            strikes.push({ type: 'short_hours', details: `Only ${hours.toFixed(2)}h worked (min 8h)` });
            console.log(`⚡ ${name}: Strike - short_hours (${hours.toFixed(2)}h)`);
          }
        } else {
          // No Jibble record at all = didn't clock in
          strikes.push({ type: 'short_hours', details: 'No Jibble clock-in recorded (0h worked)' });
          console.log(`⚡ ${name}: Strike - short_hours (no clock-in)`);
        }
      }

      // Strike 4: 2+ ClickUp tasks overdue by > 2 days
      const overdueTasks = await this.getOverdueTasksForUser(userId);
      if (overdueTasks.length >= 2) {
        strikes.push({
          type: 'overdue_tasks',
          details: `${overdueTasks.length} ClickUp tasks overdue >2 days: ${overdueTasks.map(t => t.name).join(', ')}`
        });
        console.log(`⚡ ${name}: Strike - overdue_tasks (${overdueTasks.length} tasks)`);
      }

      // Strike 5: No morning check-in response
      const checkinResp = await db.query(
        `SELECT morning_response_at FROM daily_checkins WHERE date = $1 AND user_id = $2`,
        [date, userId]
      );
      const hasCheckin = checkinResp.rows[0]?.morning_response_at;
      if (!hasCheckin) {
        strikes.push({ type: 'no_checkin', details: 'No morning check-in response' });
        console.log(`⚡ ${name}: Strike - no_checkin`);
      }

      // Save all strikes to DB
      for (const strike of strikes) {
        await db.query(
          `INSERT INTO strike_records (user_id, strike_date, strike_type, details)
           VALUES ($1, $2, $3, $4)`,
          [userId, date, strike.type, strike.details]
        );
      }

      return strikes;
    } catch (error) {
      console.error(`❌ Error evaluating member ${name}:`, error);
      return [];
    }
  },

  // ─── EOD Quality Scoring ─────────────────────────────────────────────────────

  async scoreEODQuality(text) {
    try {
      const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a technical project manager scoring EOD updates. Respond with a single integer 0-10 only. No explanation.'
          },
          {
            role: 'user',
            content: `Score this end-of-day update on a 0-10 scale based on:
- Clarity of what was done today (0-3 points)
- Blockers mentioned if relevant (0-2 points)  
- Tomorrow's plan clarity (0-3 points)
- ClickUp mentioned or tasks referenced (0-2 points)

EOD Update:
${text}

Reply with only the integer score (0-10):`
          }
        ],
        temperature: 0,
        max_tokens: 5,
      });

      const raw = response.choices[0].message.content.trim();
      const score = parseInt(raw, 10);
      return isNaN(score) ? 5 : Math.min(10, Math.max(0, score));
    } catch (error) {
      console.error('⚠️ Could not score EOD quality:', error.message);
      return 5; // neutral fallback — no strike on scoring error
    }
  },

  // ─── ClickUp Overdue Tasks ───────────────────────────────────────────────────

  async getOverdueTasksForUser(userId) {
    try {
      const token = clickupClient.getAccessToken();
      if (!token) {
        console.log('⚠️ ClickUp not authorized — skipping overdue task check');
        return [];
      }

      const listId = process.env.CLICKUP_LIST_ID;
      if (!listId) {
        console.log('⚠️ CLICKUP_LIST_ID not set — skipping overdue task check');
        return [];
      }

      const tasks = await clickupClient.getListTasks(listId);
      const now = Date.now();
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

      const userClickupNames = SLACK_TO_CLICKUP[userId] || [];

      return tasks.filter(task => {
        if (!task.due_date) return false;
        const dueMs = parseInt(task.due_date);
        if (now - dueMs < twoDaysMs) return false; // not yet 2 days overdue

        const isComplete =
          task.status.status.toLowerCase().includes('complete') ||
          task.status.status.toLowerCase().includes('done') ||
          task.status.status.toLowerCase().includes('closed');
        if (isComplete) return false;

        return task.assignees.some(a =>
          userClickupNames.includes(a.username.toLowerCase())
        );
      });
    } catch (error) {
      console.error('⚠️ Could not check ClickUp overdue tasks:', error.message);
      return [];
    }
  },

  // ─── Weekly Roll-up ──────────────────────────────────────────────────────────

  async rollupWeekly(date, members) {
    try {
      const d = new Date(date + 'T00:00:00+05:30'); // parse as IST
      const dayOfWeek = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - daysFromMonday);
      const weekStart = monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const flagged = [];

      for (const member of members) {
        const result = await db.query(
          `SELECT strike_type, COUNT(*) as count
           FROM strike_records
           WHERE user_id = $1 AND strike_date >= $2
           GROUP BY strike_type`,
          [member.user_id, weekStart]
        );

        const breakdown = {};
        let total = 0;
        for (const row of result.rows) {
          breakdown[row.strike_type] = parseInt(row.count);
          total += parseInt(row.count);
        }

        const escalated = total >= 3 ? 1 : 0;

        await db.query(
          `INSERT INTO weekly_strike_summary (user_id, week_start, total_strikes, strike_breakdown, escalated)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, week_start) DO UPDATE SET
             total_strikes = EXCLUDED.total_strikes,
             strike_breakdown = EXCLUDED.strike_breakdown,
             escalated = EXCLUDED.escalated`,
          [member.user_id, weekStart, total, JSON.stringify(breakdown), escalated]
        );

        if (escalated) {
          flagged.push({ member, total, breakdown, weekStart });
        }
      }

      return flagged;
    } catch (error) {
      console.error('❌ Error rolling up weekly strikes:', error);
      return [];
    }
  },

  // ─── Manager Notification (Antony + Phani only) ──────────────────────────────

  async notifyManagers(flaggedMembers, date) {
    if (!slackClient) return;

    let message = `⚠️ *Weekly Strike Escalation — ${date}*\n\nThe following team members have accumulated 3+ strikes this week:\n\n`;

    for (const { member, total, breakdown, weekStart } of flaggedMembers) {
      const name = member.display_name || member.real_name || member.user_id;
      const breakdownStr = Object.entries(breakdown)
        .map(([type, count]) => `${this._strikeLabel(type)}: ${count}`)
        .join(', ');
      message += `• *${name}* (<@${member.user_id}>) — *${total} strikes* (week of ${weekStart})\n  _${breakdownStr}_\n`;
    }

    message += '\n_Strike data is confidential — not shared with team members._';

    for (const managerId of MANAGERS) {
      try {
        await slackClient.chat.postMessage({
          channel: managerId,
          text: message,
        });
        console.log(`✅ Strike escalation DM sent to ${managerId}`);
      } catch (err) {
        console.error(`❌ Could not send strike DM to ${managerId}:`, err.message);
      }
    }
  },

  // ─── Query helpers (used by dailySummary + !strikes command) ────────────────

  async getTodayStrikes(date) {
    try {
      const result = await db.query(
        `SELECT sr.user_id, sr.strike_type, sr.details, tm.display_name, tm.real_name
         FROM strike_records sr
         LEFT JOIN team_members tm ON tm.user_id = sr.user_id
         WHERE sr.strike_date = $1
         ORDER BY sr.user_id, sr.strike_type`,
        [date]
      );
      return result.rows;
    } catch (err) {
      console.error('⚠️ Could not fetch today strikes:', err.message);
      return [];
    }
  },

  async getWeeklyStrikeSummary() {
    try {
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const d = nowIST;
      const dayOfWeek = d.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - daysFromMonday);
      const weekStart = monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const result = await db.query(
        `SELECT ws.user_id, ws.total_strikes, ws.strike_breakdown, ws.escalated, ws.week_start,
                tm.display_name, tm.real_name
         FROM weekly_strike_summary ws
         LEFT JOIN team_members tm ON tm.user_id = ws.user_id
         WHERE ws.week_start = $1
         ORDER BY ws.total_strikes DESC`,
        [weekStart]
      );
      return result.rows;
    } catch (err) {
      console.error('⚠️ Could not fetch weekly strike summary:', err.message);
      return [];
    }
  },

  async getUserStrikeHistory(userId, limitDays = 30) {
    try {
      const result = await db.query(
        `SELECT strike_date, strike_type, details
         FROM strike_records
         WHERE user_id = $1
           AND strike_date >= CURRENT_DATE - INTERVAL '${parseInt(limitDays)} days'
         ORDER BY strike_date DESC, strike_type`,
        [userId]
      );
      return result.rows;
    } catch (err) {
      console.error('⚠️ Could not fetch user strike history:', err.message);
      return [];
    }
  },

  // ─── Utilities ───────────────────────────────────────────────────────────────

  _strikeLabel(type) {
    const labels = {
      no_eod: 'No EOD',
      low_quality: 'Low quality EOD',
      short_hours: 'Short hours',
      overdue_tasks: 'Overdue ClickUp tasks',
      no_checkin: 'No morning check-in',
    };
    return labels[type] || type;
  },

  stop() {
    if (strikeJob) {
      strikeJob.stop();
      console.log('🛑 Strike evaluator stopped');
    }
  },
};
