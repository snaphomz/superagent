import { messageStore } from '../database/messageStore.js';

export const promptBuilder = {
  async buildSystemPrompt(userId) {
    const profile = await messageStore.getPersonalityProfile();
    
    if (!profile) {
      return this.getDefaultSystemPrompt();
    }

    const commonPhrases = profile.commonPhrases.slice(0, 10).map(p => p.phrase).join(', ');
    const topEmojis = profile.emojiPatterns.slice(0, 5).map(e => e.emoji).join(' ');
    const topGreetings = profile.greetingPatterns.slice(0, 3).map(g => g.greeting).join(', ');
    const topClosings = profile.closingPatterns.slice(0, 3).map(c => c.closing).join(', ');
    const topWords = Object.entries(profile.vocabularyFrequency).slice(0, 20).map(([word]) => word).join(', ');

    return `You are impersonating a team leader in a Slack channel. Your goal is to respond to messages in a way that matches their exact communication style.

## Communication Style Profile

**Average Message Length**: ${Math.round(profile.avgMessageLength)} characters

**Tone Characteristics**:
- Formal: ${profile.toneIndicators.formal}%
- Casual: ${profile.toneIndicators.casual}%
- Direct: ${profile.toneIndicators.direct}%
- Diplomatic: ${profile.toneIndicators.diplomatic}%
- Enthusiastic: ${profile.toneIndicators.enthusiastic}%
- Neutral: ${profile.toneIndicators.neutral}%

**Common Phrases**: ${commonPhrases || 'N/A'}

**Frequently Used Words**: ${topWords || 'N/A'}

**Emoji Usage**: ${topEmojis || 'Rarely uses emojis'}

**Typical Greetings**: ${topGreetings || 'No specific pattern'}

**Typical Closings**: ${topClosings || 'No specific pattern'}

## Instructions

1. Match the tone and style based on the profile above
2. Keep message length similar to the average (around ${Math.round(profile.avgMessageLength)} characters)
3. Use similar vocabulary and phrases when appropriate
4. Mirror the emoji usage pattern
5. For daily updates: be concise and structured
6. For check-ins: be warm and supportive
7. For questions to team members: be clear and direct
8. Maintain consistency with past communication patterns

## Response Format

Respond ONLY with the message text that should be sent. Do not include any meta-commentary, explanations, or formatting markers. Just the raw message text as it should appear in Slack.`;
  },

  getDefaultSystemPrompt() {
    return `You are a helpful team leader responding to messages in a Slack channel. 

Your communication style should be:
- Professional but friendly
- Clear and concise
- Supportive and encouraging
- Direct when needed

For daily updates: provide structured, brief updates
For check-ins: be warm and show genuine interest
For questions: be clear and helpful
For task delegation: be specific and set clear expectations

Respond ONLY with the message text that should be sent. Do not include any meta-commentary or explanations.`;
  },

  buildUserPrompt(context, currentMessage, messageType, eodContext = null, userInfo = null) {
    let prompt = `## Recent Conversation Context\n\n${context}\n\n`;
    prompt += `## New Message to Respond To\n\n${currentMessage}\n\n`;
    
    if (userInfo) {
      const userName = userInfo.profile?.display_name || userInfo.name || userInfo.real_name;
      const userMention = `<@${userInfo.id}>`;
      prompt += `## Recipient Information\n\n`;
      prompt += `User ID for mention: ${userMention}\n`;
      prompt += `User's name: ${userName}\n\n`;
      prompt += `IMPORTANT: Start your response with ${userMention} to notify them. Use their name naturally in the message.\n\n`;
    }
    
    if (messageType === 'daily_update') {
      prompt += `This appears to be a daily update request. Provide a brief, structured update on current tasks and progress.\n\n`;
    } else if (messageType === 'check_in') {
      prompt += `This is a check-in message. Respond warmly and provide a genuine status update.\n\n`;
    } else if (messageType === 'question') {
      prompt += `This is a question. Provide a clear, helpful answer.\n\n`;
    } else if (messageType === 'task_delegation') {
      prompt += `This involves task delegation. Be clear about expectations and deadlines.\n\n`;
    } else if (messageType === 'eod_followup') {
      prompt += `This is an end-of-day update from a team member. You need to ask follow-up questions.\n\n`;
      
      if (eodContext) {
        prompt += `## Update Analysis\n\n`;
        
        if (eodContext.analysis.issues.includes('no_clickup_mention')) {
          prompt += `- ClickUp not mentioned - remind them to update it\n`;
        }
        
        if (eodContext.analysis.issues.includes('no_next_day_plan')) {
          prompt += `- No next-day tasks mentioned - ask about tomorrow's priorities and clarity\n`;
        }
        
        if (eodContext.analysis.issues.includes('missing_purpose') || 
            eodContext.analysis.issues.includes('missing_process') || 
            eodContext.analysis.issues.includes('missing_payoff')) {
          prompt += `- Incomplete Purpose/Process/Payoff structure - ask for missing components\n`;
        }
        
        prompt += `\n`;
      }
      
      prompt += `Ask 1-2 specific, helpful questions to improve their update. Be supportive and constructive.\n\n`;
    }
    
    prompt += `Generate an appropriate response:`;
    
    return prompt;
  },

  async buildFullPrompt(context, currentMessage, messageType, userId, eodContext = null, userInfo = null) {
    const systemPrompt = await this.buildSystemPrompt(userId);
    const userPrompt = this.buildUserPrompt(context, currentMessage, messageType, eodContext, userInfo);
    
    return {
      system: systemPrompt,
      user: userPrompt,
    };
  },
};
