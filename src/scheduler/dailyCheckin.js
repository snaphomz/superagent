import cron from 'node-cron';
import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';
import { todayIST } from '../utils/dateUtils.js';

let morningCheckinJob = null;
let slackClient = null;
let morningCheckinMessageTs = null;

export const dailyCheckin = {
  initialize(client) {
    slackClient = client;
    this.scheduleCheckin();
  },

  getMorningCheckinTs() {
    return morningCheckinMessageTs;
  },

  scheduleCheckin() {
    const [hour, minute] = config.scheduler.morningCheckinTime.split(':');
    const cronExpression = `${minute} ${hour} * * *`;

    console.log(`📅 Scheduling morning check-in at ${config.scheduler.morningCheckinTime} ${config.scheduler.timezone}`);

    morningCheckinJob = cron.schedule(
      cronExpression,
      async () => {
        await this.sendMorningCheckin();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  async sendMorningCheckin() {
    try {
      console.log('\n🌅 Sending morning check-in message...');

      const ericMention = config.scheduler.ericUserId ? `<@${config.scheduler.ericUserId}>` : '@eric';
      const pavanMention = config.scheduler.pavanUserId ? `<@${config.scheduler.pavanUserId}>` : '@pavan';

      const message = `Good morning team! <!here> 🌅

Time for your daily planning check-in. Please reply in thread with specific details:

1️⃣ Did you spend 30 minutes planning your day? (What did you plan?)
2️⃣ Did you discuss your plan with ${ericMention} or ${pavanMention}? (Who and what was discussed?)
3️⃣ Have you engaged on Reddit today? (Which posts/comments?)
4️⃣ Are your tasks for today finalized? (What are your main tasks?)

⚠️ Please provide specific details, not just yes/no answers!`;

      const result = await slackClient.chat.postMessage({
        channel: config.target.channelId,
        text: message,
      });

      // Store the message timestamp for thread tracking
      morningCheckinMessageTs = result.ts;
      const today = todayIST();
      
      // Get all team members who should respond (non-freelancers and non-excluded)
      const allMembers = await messageStore.getTeamMembers();
      const freelancerIds = config.scheduler.freelancerIds || [];
      const excludedIds = config.scheduler.excludedUserIds || [];
      
      for (const member of allMembers) {
        if (!freelancerIds.includes(member.user_id) && !excludedIds.includes(member.user_id)) {
          await messageStore.saveCheckin({
            date: today,
            userId: member.user_id,
            morningMessageTs: result.ts,
            morningResponseAt: null,
            morningResponseText: null,
            planningDone: false,
            planningDetails: null,
            discussedWithLead: false,
            leadName: null,
            redditEngaged: false,
            redditDetails: null,
            tasksFinalized: false,
            taskDetails: null,
            responseComplete: false,
            responseSpecific: false,
            pingCount: 0,
            lastPingAt: null,
            codePushReminderSentAt: null,
            codePushAcknowledgedAt: null,
            eodUpdateReceivedAt: null,
          });
        }
      }

      console.log(`✅ Morning check-in sent! Message TS: ${result.ts}`);
    } catch (error) {
      console.error('❌ Error sending morning check-in:', error);
    }
  },

  stop() {
    if (morningCheckinJob) {
      morningCheckinJob.stop();
      console.log('🛑 Morning check-in scheduler stopped');
    }
  },

  // For testing - send immediately
  async sendNow() {
    await this.sendMorningCheckin();
  },
};
