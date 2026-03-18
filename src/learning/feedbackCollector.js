import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';
import { config } from '../config/slack.js';

export const feedbackCollector = {
  // Track reactions to bot responses
  async trackReaction(message, client) {
    try {
      // Check if this is a reaction to a bot message
      if (!message.reaction || !message.item) return;

      const reaction = message.reaction;
      const item = message.item;
      
      // Only track reactions to bot messages
      const botMessage = await this.getBotMessage(item.ts, item.channel);
      if (!botMessage) return;

      // Map reactions to feedback values
      const feedbackMap = {
        'thumbsup': { type: 'reaction', value: '👍', impact: 0.1 },
        'thumbsdown': { type: 'reaction', value: '👎', impact: -0.2 },
        'white_check_mark': { type: 'reaction', value: '✅', impact: 0.15 },
        'x': { type: 'reaction', value: '❌', impact: -0.15 },
        'tada': { type: 'reaction', value: '🎉', impact: 0.2 },
        'thinking_face': { type: 'reaction', value: '🤔', impact: -0.05 },
        'eyes': { type: 'reaction', value: '👀', impact: 0.05 }
      };

      const feedback = feedbackMap[reaction];
      if (!feedback) return;

      // Find the response log entry
      const responseLog = await messageStore.getResponseByTimestamp(item.ts, item.channel);
      if (!responseLog) return;

      // Save the feedback
      await feedbackStore.saveResponseFeedback(
        responseLog.id,
        message.user,
        feedback.type,
        feedback.value,
        feedback.impact
      );

      console.log(`📊 Tracked ${feedback.value} reaction to bot response (impact: ${feedback.impact})`);
    } catch (error) {
      console.error('Error tracking reaction:', error);
    }
  },

  // Track thread activity after bot response
  async trackThreadActivity(message, client) {
    try {
      // Only track if this is a reply in a thread where bot posted
      if (!message.thread_ts || message.thread_ts === message.ts) return;

      // Check if bot posted in this thread
      const botMessages = await this.getBotMessagesInThread(message.thread_ts, message.channel);
      if (botMessages.length === 0) return;

      // Determine if this is a follow-up question (indicates unclear response)
      const isFollowUpQuestion = message.text && message.text.includes('?');
      const isClarification = /\b(what|how|why|which|where|when|can you|could you|did you|have you)\b/i.test(message.text);

      if (isFollowUpQuestion || isClarification) {
        // Find the most recent bot response
        const latestBotResponse = botMessages[botMessages.length - 1];
        const responseLog = await messageStore.getResponseByTimestamp(latestBotResponse.ts, message.channel);
        
        if (responseLog) {
          await feedbackStore.saveResponseFeedback(
            responseLog.id,
            message.user,
            'followup',
            isFollowUpQuestion ? 'question' : 'clarification',
            -0.1 // Negative impact - response was unclear
          );

          console.log(`📊 Tracked follow-up ${isFollowUpQuestion ? 'question' : 'clarification'} (impact: -0.1)`);
        }
      }
    } catch (error) {
      console.error('Error tracking thread activity:', error);
    }
  },

  // Track corrections when users rephrase after bot response
  async trackCorrection(message, client) {
    try {
      // Look for correction patterns
      const correctionPatterns = [
        /\b(actually|rather|instead|no|i mean|let me clarify|to be clear)\b/i,
        /\b(sorry|my bad|correction|wrong|not exactly)\b/i,
        /\b(let me rephrase|what i meant was|to clarify)\b/i
      ];

      const isCorrection = correctionPatterns.some(pattern => pattern.test(message.text));
      if (!isCorrection) return;

      // Check if this follows a bot message
      const contextMessages = await messageStore.getContextMessages(message.channel, message.ts, 5);
      const recentBotMessage = contextMessages.reverse().find(msg => !msg.is_user_message);

      if (recentBotMessage) {
        const responseLog = await messageStore.getResponseByTimestamp(recentBotMessage.timestamp, message.channel);
        
        if (responseLog) {
          await feedbackStore.saveResponseFeedback(
            responseLog.id,
            message.user,
            'correction',
            'rephrase',
            -0.15 // Negative impact - bot misunderstood
          );

          console.log(`📊 Tracked user correction (impact: -0.15)`);
        }
      }
    } catch (error) {
      console.error('Error tracking correction:', error);
    }
  },

  // Calculate engagement score based on reactions and thread activity
  async calculateEngagementScore(responseId, timeWindowHours = 1) {
    try {
      const feedback = await feedbackStore.getFeedbackForResponse(responseId);
      
      let score = 0;
      let engagementCount = 0;

      feedback.forEach(f => {
        if (f.feedback_type === 'reaction') {
          score += f.confidence_impact || 0;
          engagementCount++;
        } else if (f.feedback_type === 'followup') {
          score += f.confidence_impact || 0;
          engagementCount++;
        }
      });

      // Normalize score (0-1 scale)
      const normalizedScore = engagementCount > 0 ? Math.max(0, Math.min(1, (score + engagementCount * 0.2) / (engagementCount * 0.4))) : 0.5;

      return {
        score: normalizedScore,
        engagementCount,
        feedbackCount: feedback.length
      };
    } catch (error) {
      console.error('Error calculating engagement score:', error);
      return { score: 0.5, engagementCount: 0, feedbackCount: 0 };
    }
  },

  // Helper methods
  async getBotMessage(timestamp, channelId) {
    const messages = await messageStore.getContextMessages(channelId, timestamp, 10);
    return messages.find(msg => !msg.is_user_message && msg.timestamp === timestamp);
  },

  async getBotMessagesInThread(threadTs, channelId) {
    // Get all messages in thread and filter for bot messages
    const allMessages = await messageStore.getContextMessages(channelId, null, 100);
    return allMessages.filter(msg => msg.thread_ts === threadTs && !msg.is_user_message);
  }
};
