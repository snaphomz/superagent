import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';
import { eodDetector } from '../utils/eodDetector.js';
import { yesterdayIST } from '../utils/dateUtils.js';
import db from '../database/postgres.js';

let slackClient = null;
let eodUpdateCache = new Map(); // Track EOD updates per day
let summarySentForDate = null; // Prevent duplicate sends on same date

const PHANI_KUMAR_ID = 'U09KQK8V7ST';
const MIN_EOD_HOUR_IST = 17; // Don't trigger EOD summary before 5 PM IST

export const eodSummary = {
  initialize(client) {
    slackClient = client;
    console.log('📊 EOD summary system initialized');
  },

  async trackEODUpdate(message) {
    try {
      // Only track EOD updates from the target channel
      if (message.channel !== config.target.channelId) return;

      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const today = nowIST.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const userId = message.user;

      // Check if this is an EOD update
      const isEOD = eodDetector.isEndOfDayUpdate(message.text);
      if (!isEOD) return;

      // Extract EOD components
      const eodData = eodDetector.extractUpdateComponents(message.text);

      // Update checkin record — create a minimal row if one doesn't exist
      const checkin = await messageStore.getCheckinByDate(today, userId);
      await messageStore.saveCheckin({
        date: today,
        userId: userId,
        morningMessageTs: checkin?.morning_message_ts || null,
        morningResponseAt: checkin?.morning_response_at || null,
        morningResponseText: checkin?.morning_response_text || null,
        planningDone: checkin?.planning_done || false,
        planningDetails: checkin?.planning_details || null,
        discussedWithLead: checkin?.discussed_with_lead || false,
        leadName: checkin?.lead_name || null,
        redditEngaged: checkin?.reddit_engaged || false,
        redditDetails: checkin?.reddit_details || null,
        tasksFinalized: checkin?.tasks_finalized || false,
        taskDetails: checkin?.task_details || null,
        responseComplete: checkin?.response_complete || false,
        responseSpecific: checkin?.response_specific || false,
        pingCount: checkin?.ping_count || 0,
        lastPingAt: checkin?.last_ping_at || null,
        codePushReminderSentAt: checkin?.code_push_reminder_sent_at || null,
        codePushAcknowledgedAt: checkin?.code_push_acknowledged_at || null,
        eodUpdateReceivedAt: new Date().toISOString(),
      });

      // Cache EOD update
      const cacheKey = `${today}:${userId}`;
      eodUpdateCache.set(cacheKey, {
        userId: userId,
        messageText: message.text,
        eodData: eodData,
        timestamp: new Date().toISOString(),
      });

      console.log(`📝 EOD update tracked for ${userId}`);

      // Check if all required members have submitted
      await this.checkAndSendSummary(today);
    } catch (error) {
      console.error('❌ Error tracking EOD update:', error);
    }
  },

  async checkAndSendSummary(date) {
    try {
      // Don't send before 5 PM IST — prevents early-morning false triggers
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const istHour = nowIST.getHours();
      if (istHour < MIN_EOD_HOUR_IST) {
        console.log(`⏳ EOD summary skipped — too early (${istHour}:xx IST, min ${MIN_EOD_HOUR_IST}:00)`);
        return;
      }

      // Prevent duplicate send for same date
      if (summarySentForDate === date) {
        console.log(`⏭️  EOD summary already sent for ${date}`);
        return;
      }

      // Get ALL non-exempt team members from team_members table
      const freelancerIds = config.scheduler.freelancerIds || [];
      const excludedIds = config.scheduler.excludedUserIds || [];
      const antonyId = config.target.userId;

      const membersResult = await db.query(
        `SELECT user_id FROM team_members
         WHERE exempt_from_eod = 0
           AND user_id != $1`,
        [antonyId]
      );
      const allRequired = membersResult.rows
        .map(r => r.user_id)
        .filter(uid => !freelancerIds.includes(uid) && !excludedIds.includes(uid));

      if (allRequired.length === 0) {
        console.log('⚠️  No required EOD members found');
        return;
      }

      // Check how many have submitted via cache
      const submitted = allRequired.filter(uid => eodUpdateCache.has(`${date}:${uid}`));
      console.log(`📊 EOD updates: ${submitted.length}/${allRequired.length} submitted`);

      if (submitted.length < allRequired.length) {
        const missing = allRequired.filter(uid => !eodUpdateCache.has(`${date}:${uid}`));
        console.log(`⏳ Still waiting for: ${missing.join(', ')}`);
        return;
      }

      console.log('✅ All required EOD updates received! Generating summary...');
      summarySentForDate = date;

      // Build member objects for the summary
      const memberObjs = allRequired.map(uid => ({ user_id: uid }));
      await this.sendSummaryToManager(date, memberObjs);
    } catch (error) {
      console.error('❌ Error checking EOD completion:', error);
    }
  },

  async sendSummaryToManager(date, members) {
    try {
      const programManagerId = config.scheduler.programManagerId;
      if (!programManagerId) {
        console.log('⚠️ No program manager ID configured');
        return;
      }

      let summary = `<@${programManagerId}> - Daily EOD Update Summary 📊\n\n`;
      summary += `*Date:* ${date}\n`;
      summary += `*Total Updates:* ${members.length}\n\n`;
      summary += `---\n\n`;

      for (const member of members) {
        const cacheKey = `${date}:${member.user_id}`;
        const eodCache = eodUpdateCache.get(cacheKey);

        if (eodCache) {
          summary += `👤 <@${member.user_id}>\n`;

          if (eodCache.eodData) {
            if (eodCache.eodData.purpose) {
              summary += `• *Purpose:* ${eodCache.eodData.purpose}\n`;
            }
            if (eodCache.eodData.process) {
              summary += `• *Process:* ${eodCache.eodData.process}\n`;
            }
            if (eodCache.eodData.payoff) {
              summary += `• *Payoff:* ${eodCache.eodData.payoff}\n`;
            }
            if (eodCache.eodData.clickup) {
              summary += `• *ClickUp:* ${eodCache.eodData.clickup}\n`;
            }
            if (eodCache.eodData.tomorrow) {
              summary += `• *Tomorrow:* ${eodCache.eodData.tomorrow}\n`;
            }
          } else {
            // Fallback to raw message if parsing failed
            const preview = eodCache.messageText.substring(0, 200);
            summary += `${preview}${eodCache.messageText.length > 200 ? '...' : ''}\n`;
          }

          summary += `\n`;
        }
      }

      summary += `---\n`;
      summary += `✅ All team members have submitted their EOD updates for ${date}`;

      // Send summary to Phani Kumar via DM (not public channel)
      await slackClient.chat.postMessage({
        channel: PHANI_KUMAR_ID,
        text: summary,
      });

      console.log(`✅ EOD summary sent to program manager`);

      // Clear cache for the day
      for (const member of members) {
        const cacheKey = `${date}:${member.user_id}`;
        eodUpdateCache.delete(cacheKey);
      }
    } catch (error) {
      console.error('❌ Error sending summary to manager:', error);
    }
  },

  // Clear old cache entries (run daily)
  clearOldCache() {
    const yesterdayStr = yesterdayIST();

    for (const [key] of eodUpdateCache) {
      if (key.startsWith(yesterdayStr)) {
        eodUpdateCache.delete(key);
      }
    }
  },
};
