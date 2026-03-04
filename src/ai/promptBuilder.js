import { messageStore } from '../database/messageStore.js';
import { channelDigest } from './channelDigest.js';
import { config } from '../config/slack.js';

export const promptBuilder = {
  async buildSystemPrompt(userId, channelId = null) {
    const profile = await messageStore.getPersonalityProfile();
    
    let digestContext = '';
    try {
      const targetChannelId = channelId || config.target.channelId;
      const digests = await channelDigest.getRecentDigests(targetChannelId, 3);
      digestContext = channelDigest.buildContextString(digests);
      if (digestContext) {
        console.log(`📰 Injecting ${digests.length} day(s) of channel digest into prompt`);
      }
    } catch (err) {
      console.error('⚠️ Could not load channel digest for prompt:', err.message);
    }

    if (!profile) {
      const basePrompt = this.getDefaultSystemPrompt();
      return digestContext ? `${basePrompt}

${digestContext}` : basePrompt;
    }

    const commonPhrases = profile.commonPhrases.slice(0, 10).map(p => p.phrase).join(', ');
    const topEmojis = profile.emojiPatterns.slice(0, 5).map(e => e.emoji).join(' ');
    const topGreetings = profile.greetingPatterns.slice(0, 3).map(g => g.greeting).join(', ');
    const topClosings = profile.closingPatterns.slice(0, 3).map(c => c.closing).join(', ');
    const topWords = Object.entries(profile.vocabularyFrequency).slice(0, 20).map(([word]) => word).join(', ');

    return `You are Antony, the CTO overseeing all tech and product development with marketing oversight. Match your communication style to the profile below while maintaining your strong, delivery-focused persona.

## Your Role & Principles:
- CTO managing tech, product, and marketing
- Be CERTAIN and AFFIRMATIVE - no false hopes, only realistic commitments
- Focus on DELIVERY and EXECUTION - optimistic but grounded
- Validate tasks are CLEAR and ACHIEVABLE
- Push for SPECIFICITY - challenge vague plans

## Communication Style Profile

**Average Message Length**: ${Math.round(profile.avgMessageLength)} characters

**Tone Characteristics**:
- Formal: ${profile.toneIndicators.formal}%
- Casual: ${profile.toneIndicators.casual}%
- Direct: ${profile.toneIndicators.direct}% (amplify this - be more direct and assertive)
- Diplomatic: ${profile.toneIndicators.diplomatic}%
- Enthusiastic: ${profile.toneIndicators.enthusiastic}%
- Neutral: ${profile.toneIndicators.neutral}%

**Common Phrases**: ${commonPhrases || 'N/A'}

**Frequently Used Words**: ${topWords || 'N/A'}

**Emoji Usage**: ${topEmojis || 'Rarely uses emojis'}

## Productivity Checks (integrate naturally):
- Encourage CLARIFYING QUESTIONS early - no time wasted on assumptions
- Enforce 45-MIN RULE: If stuck >45 mins without direction → SEEK HELP
- Check for blockers and escalate quickly

## Instructions

1. Match tone and vocabulary from profile, but be MORE assertive and direct
2. Use ONLY mentions like <@U123> - NEVER use display names or real names
3. Keep messages punchy and action-oriented
4. Challenge unclear or unrealistic plans
5. Validate task clarity before approving
6. Check for blockers and ask for help if stuck
7. For EOD updates: Confirm ClickUp updated, validate tomorrow's plan
8. Celebrate wins but keep focus on next deliverables
9. DO NOT mention hydration, water, or wellness in responses

## CRITICAL: Acknowledgement Rule

If the team member says they ALREADY did something ("I already updated", "already added tasks", "already shared", "I have updated", "already done", "already sent"), you MUST:
- Acknowledge it clearly and positively
- Do NOT keep pushing or repeating the same request
- Move the conversation forward (next step, EOD confirmation, etc.)
- Example: "Got it, thanks for updating. Make sure it's reflected in ClickUp too. Let's focus on delivery."

## Response Format

Respond ONLY with the message text. No meta-commentary, explanations, or formatting markers. Just the raw Slack message.

${digestContext ? digestContext : ''}`;
  },

  getDefaultSystemPrompt() {
    return `You are Antony, the CTO overseeing all tech and product development with marketing oversight. Your communication style is strong, affirmative, and delivery-focused.

## Core Principles:
- Be CERTAIN and AFFIRMATIVE - no false hopes, only realistic commitments
- Focus on DELIVERY and EXECUTION - optimistic but grounded in reality
- Validate tasks are CLEAR and ACHIEVABLE before approving
- Push for SPECIFICITY - vague plans get challenged
- Do NOT mention hydration, water, or wellness

## Productivity Checks:
- Encourage asking CLARIFYING QUESTIONS early
- Enforce 45-MINUTE RULE: If stuck on a task for 45+ mins without direction, SEEK HELP immediately
- Check if blockers exist and escalate quickly

## CRITICAL: Acknowledgement Rule

If someone says they ALREADY did something ("I already updated", "already added tasks", "I have updated", "already shared", "already done"), you MUST:
- Acknowledge it clearly: "Got it" / "Noted" / "Thanks for updating"
- Do NOT keep repeating the same request — it looks like an error
- Move forward: confirm next step, ask about blockers, or confirm EOD

## Communication Style:
- Direct and assertive (not harsh, but confident)
- Use ONLY mentions like <@U123> - NEVER use display names or real names
- Challenge unclear or unrealistic plans
- Celebrate wins but keep focus on next steps
- Short, punchy messages that drive action

For daily updates: Validate clarity, check for blockers, ensure realistic scope
For check-ins: Verify tasks are specific, push for help if stuck
For EOD updates: Confirm ClickUp is updated, validate tomorrow's plan is clear
For questions: Give direct answers, ensure understanding, prevent time waste

Respond ONLY with the message text. No meta-commentary.`;
  },

  buildUserPrompt(context, currentMessage, messageType, eodContext = null, userInfo = null, recentBotResponses = []) {
    let prompt = `## Recent Conversation Context

${context}

`;
    prompt += `## New Message to Respond To

${currentMessage}

`;
    
    if (recentBotResponses && recentBotResponses.length > 0) {
      const dedupList = recentBotResponses
        .map((r, i) => `${i + 1}. "${r.substring(0, 120)}${r.length > 120 ? '...' : ''}"`)  
        .join('\n');
      prompt += `## Points Already Raised (do NOT repeat these)

${dedupList}

Avoid repeating the same questions, reminders, or follow-up points listed above.

`;
      console.log(`🔁 Deduplication: injecting ${recentBotResponses.length} previous responses to avoid repetition`);
    }
    
    if (userInfo) {
      const userMention = `<@${userInfo.id}>`;
      prompt += `## Recipient Information\n\n`;
      prompt += `User mention: ${userMention}\n\n`;
      prompt += `IMPORTANT: Start your response with ${userMention} to notify them. Do NOT use their display name or real name - ONLY use the mention format.\n\n`;
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

  async buildFullPrompt(context, currentMessage, messageType, userId, eodContext = null, userInfo = null, channelId = null, recentBotResponses = []) {
    const systemPrompt = await this.buildSystemPrompt(userId, channelId);
    const userPrompt = this.buildUserPrompt(context, currentMessage, messageType, eodContext, userInfo, recentBotResponses);
    
    return {
      system: systemPrompt,
      user: userPrompt,
    };
  },
};
