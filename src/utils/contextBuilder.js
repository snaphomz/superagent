import { messageStore } from '../database/messageStore.js';

export const contextBuilder = {
  async buildContext(channelId, currentTimestamp, maxMessages = 20) {
    const messages = await messageStore.getContextMessages(channelId, currentTimestamp, maxMessages);
    
    const formattedMessages = messages.map(msg => ({
      role: msg.is_user_message ? 'assistant' : 'user',
      content: `${msg.user_id}: ${msg.text}`,
      timestamp: msg.timestamp,
    }));

    return formattedMessages;
  },

  async buildContextString(channelId, currentTimestamp, maxMessages = 20) {
    const messages = await this.buildContext(channelId, currentTimestamp, maxMessages);
    
    return messages
      .map(msg => msg.content)
      .join('\n');
  },

  detectMessageType(text) {
    const lowerText = text.toLowerCase();
    
    const hasEODPattern = 
      lowerText.includes('end of day') || 
      lowerText.includes('end-of-day') ||
      lowerText.includes('eod update') ||
      (lowerText.includes('update') && (lowerText.includes('purpose') || lowerText.includes('process') || lowerText.includes('payoff')));
    
    if (hasEODPattern) {
      return 'eod_update';
    }
    
    if (lowerText.includes('daily update') || lowerText.includes('status update')) {
      return 'daily_update';
    }
    
    if (lowerText.includes('check in') || lowerText.includes('checking in') || lowerText.includes('how are') || lowerText.includes('how is')) {
      return 'check_in';
    }
    
    if (text.includes('?')) {
      return 'question';
    }
    
    if (lowerText.includes('task') || lowerText.includes('todo') || lowerText.includes('can you') || lowerText.includes('could you')) {
      return 'task_delegation';
    }
    
    return 'general';
  },

  extractMentionedUsers(text) {
    const userMentionRegex = /<@([A-Z0-9]+)>/g;
    const mentions = [];
    let match;
    
    while ((match = userMentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  },

  isRelevantForResponse(message, targetUserId) {
    const text = message.text || '';
    const mentionedUsers = this.extractMentionedUsers(text);
    
    if (mentionedUsers.includes(targetUserId)) {
      return true;
    }
    
    const messageType = this.detectMessageType(text);
    // Respond to all meaningful message types
    if (['question', 'check_in', 'task_delegation', 'daily_update', 'eod_update'].includes(messageType)) {
      return true;
    }

    // Respond to any substantive message (>30 chars) — catches task lists, updates, general updates
    if (text.trim().length > 30) {
      return true;
    }
    
    return false;
  },
};
