import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';
import { eodDetector } from './eodDetector.js';

export const externalChannelFetcher = {
  async fetchExternalMessages(client, hours = 4) {
    try {
      const now = new Date();
      const lookbackTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const oldestTimestamp = (lookbackTime.getTime() / 1000).toString();

      console.log(`📡 Fetching messages from external channel (last ${hours} hours)...`);

      const result = await client.conversations.history({
        channel: config.obiTeam.externalChannelId,
        oldest: oldestTimestamp,
        limit: 200,
      });

      if (!result.messages || result.messages.length === 0) {
        console.log('⚠️ No messages found in external channel');
        return [];
      }

      // Filter out bot messages and format
      const messages = result.messages
        .filter(msg => !msg.bot_id && msg.type === 'message')
        .reverse() // Chronological order
        .map(msg => ({
          user: msg.user,
          text: msg.text,
          timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
          ts: msg.ts,
        }));

      console.log(`✅ Found ${messages.length} messages from external channel`);
      return messages;
    } catch (error) {
      console.error('❌ Error fetching external messages:', error);
      return [];
    }
  },

  async fetchInternalEODUpdates(hours = 24) {
    try {
      console.log(`📊 Fetching internal EOD updates (last ${hours} hours)...`);

      const now = new Date();
      const lookbackTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const oldestTimestamp = (lookbackTime.getTime() / 1000).toString();

      // Get recent messages from the database
      const allMessages = await messageStore.getMessages(500);
      
      // Filter for EOD updates in the lookback period
      const eodUpdates = allMessages
        .filter(msg => {
          const msgTime = new Date(msg.timestamp * 1000);
          return msgTime >= lookbackTime && eodDetector.isEndOfDayUpdate(msg.text);
        })
        .map(msg => ({
          user: msg.user_id,
          text: msg.text,
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          components: eodDetector.extractUpdateComponents(msg.text),
        }));

      console.log(`✅ Found ${eodUpdates.length} EOD updates`);
      return eodUpdates;
    } catch (error) {
      console.error('❌ Error fetching EOD updates:', error);
      return [];
    }
  },

  async fetchInternalCheckins(date = null) {
    try {
      const today = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      console.log(`📋 Fetching internal check-ins for ${today}...`);

      const checkins = await messageStore.getTodayCheckins(today);

      const formattedCheckins = checkins
        .filter(c => c.morning_response_at)
        .map(c => ({
          userId: c.user_id,
          planningDone: c.planning_done,
          planningDetails: c.planning_details,
          discussedWithLead: c.discussed_with_lead,
          leadName: c.lead_name,
          redditEngaged: c.reddit_engaged,
          tasksFinalized: c.tasks_finalized,
          taskDetails: c.task_details,
        }));

      console.log(`✅ Found ${formattedCheckins.length} check-ins`);
      return formattedCheckins;
    } catch (error) {
      console.error('❌ Error fetching check-ins:', error);
      return [];
    }
  },

  async combineContextData(client) {
    try {
      console.log('\n🔄 Gathering context data from all sources...');

      const [externalMessages, eodUpdates, checkins] = await Promise.all([
        this.fetchExternalMessages(client, config.obiTeam.lookbackHours),
        this.fetchInternalEODUpdates(24),
        this.fetchInternalCheckins(),
      ]);

      // Get user info for better formatting
      const teamMembers = await messageStore.getTeamMembers();

      return {
        external: {
          messages: externalMessages,
          count: externalMessages.length,
        },
        internal: {
          eodUpdates: eodUpdates,
          checkins: checkins,
          teamMembers: teamMembers,
        },
        metadata: {
          externalLookbackHours: config.obiTeam.lookbackHours,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Error combining context data:', error);
      throw error;
    }
  },

  getUserDisplayName(userId, teamMembers) {
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.display_name || member?.real_name || userId;
  },
};
