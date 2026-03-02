import { config } from '../config/slack.js';
import { externalChannelFetcher } from '../utils/externalChannelFetcher.js';
import { responseTracker } from '../utils/responseTracker.js';
import { deploymentSummary } from '../ai/deploymentSummary.js';

export const obiTeamMonitor = {
  async handleMessage(message, client) {
    try {
      // Only process messages from OBI Team user
      if (message.user !== config.obiTeam.userId) {
        return;
      }

      console.log('\n👤 OBI Team message detected');

      // Check for "purpose" keyword
      if (this.detectPurposeKeyword(message.text)) {
        console.log('🎯 Purpose keyword detected - generating summary');
        await this.handlePurposeSummary(message, client);
        return;
      }

      // Check for direct questions or mentions
      if (this.detectQuestionOrMention(message.text)) {
        console.log('❓ Question or mention detected - pinging leads');
        await this.handleDirectRequest(message, client);
        return;
      }

      console.log('ℹ️ Regular OBI Team message (no action needed)');
    } catch (error) {
      console.error('❌ Error handling OBI Team message:', error);
    }
  },

  detectPurposeKeyword(text) {
    if (!text) return false;
    
    // Check if message starts with "purpose" (case-insensitive)
    const trimmed = text.trim().toLowerCase();
    return trimmed.startsWith('purpose:') || trimmed.startsWith('purpose ');
  },

  detectQuestionOrMention(text) {
    if (!text) return false;

    const lowerText = text.toLowerCase();

    // Check for question mark
    if (text.includes('?')) {
      return true;
    }

    // Check for Eric or Pavan mentions (various formats)
    const mentionPatterns = [
      'eric',
      'pavan',
      '@eric',
      '@pavan',
      '<@' + config.obiTeam.ericUserId,
      '<@' + config.obiTeam.pavanUserId,
    ];

    return mentionPatterns.some(pattern => lowerText.includes(pattern));
  },

  async handlePurposeSummary(message, client) {
    try {
      console.log('\n📊 Processing purpose summary request...');

      // Create request record
      const requestId = await responseTracker.createRequest(
        'purpose_summary',
        message.ts,
        message.text
      );

      // Gather context data from all sources
      const contextData = await externalChannelFetcher.combineContextData(client);

      // Generate AI summary
      const summary = await deploymentSummary.generatePurposeSummary(contextData);

      // Format the summary message
      const formattedSummary = deploymentSummary.formatPurposeSummary(
        summary,
        config.obiTeam.externalChannelId
      );

      // Add Eric and Pavan mentions
      const finalMessage = `${formattedSummary}

**Action Required:**
<@${config.obiTeam.ericUserId}> <@${config.obiTeam.pavanUserId}> - Please review the above updates and respond with any concerns or actions needed.`;

      // Post summary to channel
      const result = await client.chat.postMessage({
        channel: config.target.channelId,
        text: finalMessage,
      });

      // Update request with summary timestamp
      await responseTracker.updateSummaryPosted(requestId, result.ts);

      console.log(`✅ Purpose summary posted! Message TS: ${result.ts}`);
    } catch (error) {
      console.error('❌ Error handling purpose summary:', error);
      
      // Post error message
      await client.chat.postMessage({
        channel: config.target.channelId,
        text: `⚠️ I encountered an error generating the deployment summary. Please check the logs.`,
      });
    }
  },

  async handleDirectRequest(message, client) {
    try {
      console.log('\n❓ Processing direct request...');

      // Create request record
      const requestId = await responseTracker.createRequest(
        'direct_question',
        message.ts,
        message.text
      );

      // Analyze the request using AI
      const analysis = await deploymentSummary.analyzeDirectRequest(message.text);

      // Format the ping message
      const pingMessage = deploymentSummary.formatDirectRequestMessage(
        analysis,
        config.obiTeam.userId,
        config.obiTeam.ericUserId,
        config.obiTeam.pavanUserId
      );

      // Post ping to channel
      const result = await client.chat.postMessage({
        channel: config.target.channelId,
        text: pingMessage,
      });

      // Update request with summary timestamp
      await responseTracker.updateSummaryPosted(requestId, result.ts);

      console.log(`✅ Direct request ping posted! Message TS: ${result.ts}`);
    } catch (error) {
      console.error('❌ Error handling direct request:', error);
      
      // Fallback: simple ping
      await client.chat.postMessage({
        channel: config.target.channelId,
        text: `<@${config.obiTeam.ericUserId}> <@${config.obiTeam.pavanUserId}> - OBI Team needs your attention: ${message.text}`,
      });
    }
  },

  async trackResponse(message, client) {
    try {
      // Check if this is a response to an OBI Team request
      if (!message.thread_ts) {
        return; // Not a thread reply
      }

      // Check if the responder is Eric or Pavan
      const isEricOrPavan = 
        message.user === config.obiTeam.ericUserId ||
        message.user === config.obiTeam.pavanUserId;

      if (!isEricOrPavan) {
        return;
      }

      // Track the response
      await responseTracker.trackResponse(message.thread_ts, message.user);
    } catch (error) {
      console.error('❌ Error tracking response:', error);
    }
  },

  async getPendingResponses() {
    try {
      return await responseTracker.checkPendingResponses();
    } catch (error) {
      console.error('❌ Error getting pending responses:', error);
      return [];
    }
  },
};
