import cron from 'node-cron';
import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';
import { responseValidator } from '../utils/responseValidator.js';

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

      const today = new Date().toISOString().split('T')[0];
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

      // Process each response
      for (const msg of threadMessages) {
        if (msg.bot_id) continue; // Skip bot messages

        const userId = msg.user;
        const checkin = await messageStore.getCheckinByDate(today, userId);

        if (!checkin || checkin.response_complete) continue;

        // Validate the response
        const validation = responseValidator.validateResponse(msg.text);

        // Update checkin with parsed data
        await messageStore.saveCheckin({
          date: today,
          userId: userId,
          morningMessageTs: morningMessageTs,
          morningResponseAt: new Date(parseFloat(msg.ts) * 1000).toISOString(),
          morningResponseText: msg.text,
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

        // Send clarification if needed
        if (!validation.isValid) {
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

          console.log(`📨 Sent clarification request to ${userId}`);
        } else {
          console.log(`✅ Valid response from ${userId}`);
        }
      }

      // Ping non-responders
      await this.pingNonResponders(today, morningMessageTs);

      console.log('✅ Validation complete');
    } catch (error) {
      console.error('❌ Error validating responses:', error);
    }
  },

  async pingNonResponders(date, morningMessageTs) {
    try {
      const checkins = await messageStore.getTodayCheckins(date);
      const freelancerIds = config.scheduler.freelancerIds || [];

      for (const checkin of checkins) {
        // Skip freelancers
        if (freelancerIds.includes(checkin.user_id)) continue;

        // Skip if already responded
        if (checkin.morning_response_at) continue;

        // Skip if already pinged max times
        if (checkin.ping_count >= config.scheduler.maxPingAttempts) continue;

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
      const now = new Date();
      const currentHour = now.getHours();

      // Only ping between 10 AM and 5 PM IST
      if (currentHour < 10 || currentHour >= 17) {
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const checkins = await messageStore.getTodayCheckins(today);

      if (checkins.length === 0) return;

      const morningMessageTs = checkins[0]?.morning_message_ts;
      if (!morningMessageTs) return;

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
