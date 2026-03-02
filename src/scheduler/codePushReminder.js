import cron from 'node-cron';
import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';

let codePushJob = null;
let slackClient = null;
let codePushMessageTs = null;

export const codePushReminder = {
  initialize(client) {
    slackClient = client;
    this.scheduleReminder();
  },

  scheduleReminder() {
    const [hour, minute] = config.scheduler.codePushTime.split(':');
    const cronExpression = `${minute} ${hour} * * *`;

    console.log(`📅 Scheduling code push reminder at ${config.scheduler.codePushTime} ${config.scheduler.timezone}`);

    codePushJob = cron.schedule(
      cronExpression,
      async () => {
        await this.sendCodePushReminder();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  async sendCodePushReminder() {
    try {
      console.log('\n🚀 Sending code push reminder...');

      const message = `<!here> Team reminder! ⏰

🚀 Time to push your code and run tests!

Please acknowledge in thread once you've:
✅ Pushed your code
✅ Run tests
✅ Verified everything works

Reply with your status!`;

      const result = await slackClient.chat.postMessage({
        channel: config.target.channelId,
        text: message,
      });

      codePushMessageTs = result.ts;

      // Update all check-ins with reminder timestamp
      const today = new Date().toISOString().split('T')[0];
      const checkins = await messageStore.getTodayCheckins(today);

      for (const checkin of checkins) {
        await messageStore.saveCheckin({
          date: today,
          userId: checkin.user_id,
          morningMessageTs: checkin.morning_message_ts,
          morningResponseAt: checkin.morning_response_at,
          morningResponseText: checkin.morning_response_text,
          planningDone: checkin.planning_done,
          planningDetails: checkin.planning_details,
          discussedWithLead: checkin.discussed_with_lead,
          leadName: checkin.lead_name,
          redditEngaged: checkin.reddit_engaged,
          redditDetails: checkin.reddit_details,
          tasksFinalized: checkin.tasks_finalized,
          taskDetails: checkin.task_details,
          responseComplete: checkin.response_complete,
          responseSpecific: checkin.response_specific,
          pingCount: checkin.ping_count,
          lastPingAt: checkin.last_ping_at,
          codePushReminderSentAt: new Date().toISOString(),
          codePushAcknowledgedAt: checkin.code_push_acknowledged_at,
          eodUpdateReceivedAt: checkin.eod_update_received_at,
        });
      }

      console.log(`✅ Code push reminder sent! Message TS: ${result.ts}`);
    } catch (error) {
      console.error('❌ Error sending code push reminder:', error);
    }
  },

  async trackAcknowledgment(userId, messageTs) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const checkin = await messageStore.getCheckinByDate(today, userId);

      if (checkin && !checkin.code_push_acknowledged_at) {
        await messageStore.saveCheckin({
          date: today,
          userId: userId,
          morningMessageTs: checkin.morning_message_ts,
          morningResponseAt: checkin.morning_response_at,
          morningResponseText: checkin.morning_response_text,
          planningDone: checkin.planning_done,
          planningDetails: checkin.planning_details,
          discussedWithLead: checkin.discussed_with_lead,
          leadName: checkin.lead_name,
          redditEngaged: checkin.reddit_engaged,
          redditDetails: checkin.reddit_details,
          tasksFinalized: checkin.tasks_finalized,
          taskDetails: checkin.task_details,
          responseComplete: checkin.response_complete,
          responseSpecific: checkin.response_specific,
          pingCount: checkin.ping_count,
          lastPingAt: checkin.last_ping_at,
          codePushReminderSentAt: checkin.code_push_reminder_sent_at,
          codePushAcknowledgedAt: new Date().toISOString(),
          eodUpdateReceivedAt: checkin.eod_update_received_at,
        });

        console.log(`✅ Code push acknowledged by ${userId}`);
      }
    } catch (error) {
      console.error('❌ Error tracking acknowledgment:', error);
    }
  },

  getCodePushMessageTs() {
    return codePushMessageTs;
  },

  stop() {
    if (codePushJob) {
      codePushJob.stop();
      console.log('🛑 Code push reminder scheduler stopped');
    }
  },

  // For testing
  async sendNow() {
    await this.sendCodePushReminder();
  },
};
