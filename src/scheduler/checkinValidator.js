import cron from 'node-cron';
import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';
import { responseValidator } from '../utils/responseValidator.js';

// In-memory store for schedule exceptions parsed from Antony's Note: messages
// Format: { userId: { lateStart: 18 } }  (lateStart = IST hour they start work)
export const scheduleExceptions = new Map();

export function setScheduleException(userId, exception) {
  scheduleExceptions.set(userId, exception);
  console.log(`📋 Schedule exception set for ${userId}:`, exception);
}

export function clearScheduleExceptions() {
  scheduleExceptions.clear();
}

let validationJob = null;
let pingJob = null;
let slackClient = null;

export const checkinValidator = {
  initialize(client) {
    slackClient = client;
    this.scheduleValidation();
    this.schedulePingCheck();
  },

  scheduleValidation() {
    const [hour, minute] = config.scheduler.validationTime.split(':');
    const cronExpression = `${minute} ${hour} * * *`;

    console.log(`📅 Scheduling check-in validation at ${config.scheduler.validationTime} ${config.scheduler.timezone}`);

    validationJob = cron.schedule(
      cronExpression,
      async () => {
        await this.validateResponses();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  schedulePingCheck() {
    // Check every 30 minutes for non-responders
    const interval = config.scheduler.pingInterval || 30;
    const cronExpression = `*/${interval} * * * *`;

    console.log(`📅 Scheduling ping check every ${interval} minutes`);

    pingJob = cron.schedule(
      cronExpression,
      async () => {
        await this.checkAndPingNonResponders();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  async validateResponses() {
    try {
      console.log('\n🔍 Validating morning check-in responses...');

      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const today = nowIST.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const checkins = await messageStore.getTodayCheckins(today);

      if (checkins.length === 0) {
        console.log('⚠️ No check-ins found for today');
        return;
      }

      const morningMessageTs = checkins[0]?.morning_message_ts;
      if (!morningMessageTs) {
        console.log('⚠️ No morning message timestamp found');
        return;
      }

      // Fetch thread replies
      const replies = await slackClient.conversations.replies({
        channel: config.target.channelId,
        ts: morningMessageTs,
      });

      const threadMessages = replies.messages.slice(1); // Skip the parent message

      // Also scan recent channel messages (last 3 hours) for task posts not in thread
      // Members often post "Todays tasks:" directly in channel instead of replying to thread
      let channelMessages = [];
      try {
        const threeHoursAgo = String(Math.floor(Date.now() / 1000) - 3 * 60 * 60);
        const channelHistory = await slackClient.conversations.history({
          channel: config.target.channelId,
          oldest: threeHoursAgo,
          limit: 100,
        });
        channelMessages = (channelHistory.messages || []).filter(m => !m.bot_id && m.user && !m.thread_ts);
      } catch (err) {
        console.error('⚠️ Could not fetch channel history for check-in scan:', err.message);
      }

      // Build a set of user IDs who have already been clarification-pinged this run
      const clarificationSentThisRun = new Set();

      // Collect latest message per user from thread replies first, then channel messages
      const latestPerUser = {};
      for (const msg of threadMessages) {
        if (msg.bot_id) continue;
        if (!msg.user) continue;
        if (!latestPerUser[msg.user] || parseFloat(msg.ts) > parseFloat(latestPerUser[msg.user].ts)) {
          latestPerUser[msg.user] = msg;
        }
      }
      // Channel messages fill in for users who haven't replied in thread
      for (const msg of channelMessages) {
        if (msg.bot_id) continue;
        if (!msg.user) continue;
        const hasTaskKeywords = msg.text && (
          /today.{0,10}tasks?/i.test(msg.text) ||
          /todays tasks/i.test(msg.text) ||
          /my tasks/i.test(msg.text) ||
          /working on/i.test(msg.text) ||
          msg.text.length > 80
        );
        if (!hasTaskKeywords) continue;
        // Only use channel message if no thread reply exists for this user
        if (!latestPerUser[msg.user]) {
          latestPerUser[msg.user] = { ...msg, _fromChannel: true };
        }
      }

      for (const [userId, msg] of Object.entries(latestPerUser)) {
        const checkin = await messageStore.getCheckinByDate(today, userId);
        if (!checkin) continue;

        const responseText = msg.text || '';
        const hasFiles = msg.files && msg.files.length > 0;
        const hasAttachments = msg.attachments && msg.attachments.length > 0;
        const hasContent = responseText.trim().length > 0 || hasFiles || hasAttachments;

        // Always mark as responded if they replied at all — stops pinging
        if (!checkin.morning_response_at && hasContent) {
          const responseAt = new Date(parseFloat(msg.ts) * 1000).toISOString();

          if (!responseText.trim() || responseText.trim().length < 10) {
            // File/image only or very short — count as responded, skip clarification
            await messageStore.saveCheckin({
              date: today,
              userId,
              morningMessageTs,
              morningResponseAt: responseAt,
              morningResponseText: responseText || '[file/task shared]',
              planningDone: false,
              planningDetails: null,
              discussedWithLead: false,
              leadName: null,
              redditEngaged: false,
              redditDetails: null,
              tasksFinalized: true, // they shared tasks, count it
              taskDetails: 'Shared via file/attachment',
              responseComplete: false,
              responseSpecific: false,
              pingCount: checkin.ping_count || 0,
              lastPingAt: checkin.last_ping_at,
              codePushReminderSentAt: checkin.code_push_reminder_sent_at,
              codePushAcknowledgedAt: checkin.code_push_acknowledged_at,
              eodUpdateReceivedAt: checkin.eod_update_received_at,
            });
            console.log(`📎 Marked ${userId} as responded (file/task share)`);
            continue;
          }

          if (checkin.response_complete) {
            console.log(`⏭️  ${userId} already marked complete`);
            continue;
          }

          // Validate text response
          const validation = responseValidator.validateResponse(responseText);

          await messageStore.saveCheckin({
            date: today,
            userId,
            morningMessageTs,
            morningResponseAt: responseAt,
            morningResponseText: responseText,
            planningDone: validation.parsedData?.planningDone || false,
            planningDetails: validation.parsedData?.planningDetails,
            discussedWithLead: validation.parsedData?.discussedWithLead || false,
            leadName: validation.parsedData?.leadName,
            redditEngaged: validation.parsedData?.redditEngaged || false,
            redditDetails: validation.parsedData?.redditDetails,
            tasksFinalized: validation.parsedData?.tasksFinalized || false,
            taskDetails: validation.parsedData?.taskDetails,
            responseComplete: validation.isComplete,
            responseSpecific: validation.isSpecific,
            pingCount: checkin.ping_count || 0,
            lastPingAt: checkin.last_ping_at,
            codePushReminderSentAt: checkin.code_push_reminder_sent_at,
            codePushAcknowledgedAt: checkin.code_push_acknowledged_at,
            eodUpdateReceivedAt: checkin.eod_update_received_at,
          });

          // Send clarification only once per user per run
          if (!validation.isValid && !clarificationSentThisRun.has(userId)) {
            let clarificationMsg;
            if (validation.missingItems.length > 0 || validation.vagueItems.length > 0) {
              clarificationMsg = responseValidator.generateClarificationMessage(userId, validation);
            } else {
              clarificationMsg = responseValidator.generateVagueResponseMessage(userId);
            }

            await slackClient.chat.postMessage({
              channel: config.target.channelId,
              text: clarificationMsg,
              thread_ts: morningMessageTs,
            });

            clarificationSentThisRun.add(userId);
            console.log(`📨 Sent clarification request to ${userId}`);
          } else if (validation.isValid) {
            console.log(`✅ Valid response from ${userId}`);
          }
        }
      }

      console.log('✅ Validation complete');
    } catch (error) {
      console.error('❌ Error validating responses:', error);
    }
  },

  async pingNonResponders(date, morningMessageTs) {
    try {
      const checkins = await messageStore.getTodayCheckins(date);
      const freelancerIds = config.scheduler.freelancerIds || [];
      const excludedIds = config.scheduler.excludedUserIds || [];

      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const currentISTHour = nowIST.getHours();

      for (const checkin of checkins) {
        // Skip freelancers
        if (freelancerIds.includes(checkin.user_id)) {
          console.log(`⏭️  Skipping freelancer: ${checkin.user_id}`);
          continue;
        }

        // Skip excluded users (Antony, Phani Kumar, Slackbot, Alfred, etc.)
        if (excludedIds.includes(checkin.user_id)) {
          console.log(`⏭️  Skipping excluded user: ${checkin.user_id}`);
          continue;
        }

        // Skip if schedule exception: user has a late start and it's before their start hour
        const exception = scheduleExceptions.get(checkin.user_id);
        if (exception && exception.lateStart && currentISTHour < exception.lateStart) {
          console.log(`⏭️  Skipping ${checkin.user_id} - late start at ${exception.lateStart}:00 IST (now ${currentISTHour}:00 IST)`);
          continue;
        }

        // Skip if already responded or marked complete
        if (checkin.morning_response_at || checkin.response_complete) {
          console.log(`⏭️  User already responded: ${checkin.user_id}`);
          continue;
        }

        // Skip if already pinged max times
        if (checkin.ping_count >= config.scheduler.maxPingAttempts) {
          console.log(`⏭️  Max pings reached for: ${checkin.user_id}`);
          continue;
        }

        // Send ping
        const message = `<@${checkin.user_id}> - I haven't received your morning check-in yet. Are you not working today or is this a sick day? Please let us know! 🙏`;

        await slackClient.chat.postMessage({
          channel: config.target.channelId,
          text: message,
          thread_ts: morningMessageTs,
        });

        // Update ping count
        await messageStore.updateCheckinPing(
          date,
          checkin.user_id,
          (checkin.ping_count || 0) + 1,
          new Date().toISOString()
        );

        console.log(`📌 Pinged non-responder: ${checkin.user_id} (ping #${(checkin.ping_count || 0) + 1})`);
      }
    } catch (error) {
      console.error('❌ Error pinging non-responders:', error);
    }
  },

  async checkAndPingNonResponders() {
    try {
      // Get current time in IST
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const currentHour = nowIST.getHours();

      // Only ping between 10 AM and 7 PM IST (extended to catch late-start members)
      if (currentHour < 10 || currentHour >= 19) {
        console.log(`⏭️  Skipping ping check - outside hours (current IST hour: ${currentHour})`);
        return;
      }

      // Clear yesterday's schedule exceptions at midnight IST
      if (currentHour === 0) {
        clearScheduleExceptions();
        console.log('🧹 Cleared schedule exceptions for new day');
      }

      const today = nowIST.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const checkins = await messageStore.getTodayCheckins(today);

      if (checkins.length === 0) {
        console.log('⏭️  No check-ins found for ping check');
        return;
      }

      const morningMessageTs = checkins[0]?.morning_message_ts;
      if (!morningMessageTs) {
        console.log('⏭️  No morning message timestamp for ping check');
        return;
      }

      await this.pingNonResponders(today, morningMessageTs);
    } catch (error) {
      console.error('❌ Error in ping check:', error);
    }
  },

  stop() {
    if (validationJob) {
      validationJob.stop();
      console.log('🛑 Validation scheduler stopped');
    }
    if (pingJob) {
      pingJob.stop();
      console.log('🛑 Ping scheduler stopped');
    }
  },

  // For testing
  async validateNow() {
    await this.validateResponses();
  },
};
