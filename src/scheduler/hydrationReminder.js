import cron from 'node-cron';
import { config } from '../config/slack.js';
import { messageStore } from '../database/messageStore.js';
import { openai, GPT_MODEL } from '../ai/openaiClient.js';

let hydrationCheckJob = null;
let slackClient = null;
let lastActivityTime = Date.now();
let lastHydrationReminder = null;


export const hydrationReminder = {
  initialize(client) {
    slackClient = client;
    this.scheduleHydrationChecks();
    console.log('💧 Hydration reminder system initialized');
  },

  // Track channel activity
  recordActivity() {
    lastActivityTime = Date.now();
  },

  scheduleHydrationChecks() {
    // Check every 30 minutes for radio silence
    hydrationCheckJob = cron.schedule(
      '*/30 * * * *',
      async () => {
        await this.checkForSilence();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  async checkForSilence() {
    try {
      // Only send reminders during IST working hours: 9 AM – 7 PM
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const istHour = nowIST.getHours();
      if (istHour < 9 || istHour >= 19) {
        console.log(`💧 Skipping hydration reminder - outside working hours (IST ${istHour}:00)`);
        return;
      }

      const now = Date.now();
      const silenceDuration = now - lastActivityTime;
      const silenceThresholdMs = 90 * 60 * 1000; // 90 minutes of silence

      // Check if we've already sent a reminder recently (within last 2 hours)
      if (lastHydrationReminder) {
        const timeSinceLastReminder = now - lastHydrationReminder;
        const reminderCooldownMs = 2 * 60 * 60 * 1000; // 2 hours
        
        if (timeSinceLastReminder < reminderCooldownMs) {
          console.log('💧 Skipping hydration reminder - sent one recently');
          return;
        }
      }

      // If there's been radio silence for 90+ minutes, send hydration reminder
      if (silenceDuration >= silenceThresholdMs) {
        console.log(`💧 Radio silence detected (${Math.round(silenceDuration / 60000)} minutes) - sending hydration reminder`);
        await this.sendHydrationReminder();
        lastHydrationReminder = now;
      }
    } catch (error) {
      console.error('❌ Error checking for silence:', error);
    }
  },

  async sendHydrationReminder() {
    try {
      // Get Antony's personality profile
      const profile = await messageStore.getPersonalityProfile();
      
      if (!profile) {
        // Fallback if no profile
        await slackClient.chat.postMessage({
          channel: config.target.channelId,
          text: '<!here> Quick break reminder - grab water, stay hydrated. Use this moment to clarify your next 2 tasks. If stuck >45 mins on anything, ask for help. Keep the momentum going.',
        });
        return;
      }

      // Generate message in Antony's voice
      const message = await this.generateHydrationMessage(profile);

      await slackClient.chat.postMessage({
        channel: config.target.channelId,
        text: message,
      });

      console.log('✅ Hydration reminder sent in Antony\'s voice');
    } catch (error) {
      console.error('❌ Error sending hydration reminder:', error);
    }
  },

  async generateHydrationMessage(profile) {
    try {
      const commonPhrases = profile.commonPhrases.slice(0, 10).map(p => p.phrase).join(', ');
      const topEmojis = profile.emojiPatterns.slice(0, 5).map(e => e.emoji).join(' ');
      const topWords = Object.entries(profile.vocabularyFrequency).slice(0, 20).map(([word]) => word).join(', ');
      const avgLength = Math.round(profile.avgMessageLength);

      const systemPrompt = `You are Antony, the CTO. Generate a hydration reminder message that matches your exact communication style.

## Communication Style Profile

**Average Message Length**: ${avgLength} characters (IMPORTANT: Keep your message around this length)

**Tone Characteristics**:
- Formal: ${profile.toneIndicators.formal}%
- Casual: ${profile.toneIndicators.casual}%
- Direct: ${profile.toneIndicators.direct}%
- Diplomatic: ${profile.toneIndicators.diplomatic}%
- Enthusiastic: ${profile.toneIndicators.enthusiastic}%
- Neutral: ${profile.toneIndicators.neutral}%

**Common Phrases**: ${commonPhrases || 'N/A'}

**Frequently Used Words**: ${topWords || 'N/A'}

**Emoji Usage**: ${topEmojis || 'Rarely uses emojis'} - USE SPARINGLY (1-2 max)

## Instructions

1. Generate a hydration reminder that sounds EXACTLY like Antony would say it
2. Keep it around ${avgLength} characters (match the average message length)
3. Use similar vocabulary and phrases from the profile
4. Match the tone percentages above
5. Use MINIMAL emojis (1-2 maximum, not excessive)
6. Be direct and assertive (CTO style) but caring
7. Start with <!here> to notify everyone
8. ADD VALUE beyond just hydration:
   - Suggest specific productivity improvements
   - Challenge team to clarify blockers or priorities
   - Remind about 45-min stuck rule (ask for help)
   - Encourage asking clarifying questions
9. If uncertain about priorities/context, ASK Antony for feedback by mentioning <@${config.target.userId}>
10. Make it actionable and delivery-focused

Generate ONLY the message text, nothing else.`;

      const userPrompt = `Generate a hydration reminder message. The team has been quiet for a while (radio silence).

Your message should:
1. Remind them to stay hydrated (drink water)
2. Add VALUE - suggest 1-2 specific productivity improvements or focus areas
3. Be actionable - what should they do next to improve delivery?
4. Challenge them to clarify blockers or ask questions if stuck
5. Use minimal emojis (1-2 max, not excessive)
6. Sound natural and direct, exactly how Antony (CTO) would say it
7. If you're unsure about current priorities or need context, ASK Antony for feedback by mentioning him

Examples of adding value:
- "Use this break to clarify your next 2 tasks"
- "If you're stuck >45 mins, ping me or the team"
- "Review your ClickUp - are priorities clear?"
- "Quick sync needed on blockers?"

Make it sound like Antony: direct, delivery-focused, adding value beyond just hydration.`;

      const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Error generating hydration message:', error);
      // Fallback message
      return '<!here> Quick break reminder - grab water, stay hydrated. Use this moment to clarify your next 2 tasks. If stuck >45 mins on anything, ask for help. Keep the momentum going.';
    }
  },

  stop() {
    if (hydrationCheckJob) {
      hydrationCheckJob.stop();
      console.log('🛑 Hydration reminder scheduler stopped');
    }
  },

  // For testing - send immediately
  async sendNow() {
    await this.sendHydrationReminder();
  },
};
