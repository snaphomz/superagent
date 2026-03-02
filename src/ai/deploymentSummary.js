import OpenAI from 'openai';
import { config } from '../config/slack.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export const deploymentSummary = {
  async generatePurposeSummary(contextData) {
    try {
      console.log('\n🤖 Generating intelligent deployment summary...');

      const { external, internal } = contextData;

      // Format external messages
      const externalText = external.messages.length > 0
        ? external.messages.map(msg => `[${msg.timestamp}] ${msg.text}`).join('\n')
        : 'No messages in the last 4 hours';

      // Format EOD updates
      const eodText = internal.eodUpdates.length > 0
        ? internal.eodUpdates.map(eod => {
            const userName = this.getUserName(eod.user, internal.teamMembers);
            return `${userName}:\n${eod.text}`;
          }).join('\n\n')
        : 'No recent EOD updates';

      // Format check-ins
      const checkinText = internal.checkins.length > 0
        ? internal.checkins.map(c => {
            const userName = this.getUserName(c.userId, internal.teamMembers);
            return `${userName}: ${c.taskDetails || 'No task details'}`;
          }).join('\n')
        : 'No check-ins today';

      const prompt = `You are analyzing deployment updates from an external development team and internal team progress.

**External Deployment Team Messages (last 4 hours from C08UM4WCYAZ):**
${externalText}

**Internal Team EOD Updates (recent):**
${eodText}

**Internal Team Check-ins (today):**
${checkinText}

Analyze and provide a comprehensive summary with:
1. **External Team Activity**: What the external deployment team has been working on, deployed, or encountered
2. **Internal Team Status**: What the internal team has been working on based on EOD updates and check-ins
3. **Pending Items/Gaps**: Identify any pending work, blockers, or items that need attention
4. **Action Items for Eric and Pavan**: Specific things they need to review or address in the external channel
5. **Urgency Flags**: Highlight any urgent or blocking issues with ⚠️

Format the response in clear sections with bullet points. Be specific and actionable.`;

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a technical project manager analyzing deployment status and team progress. Be concise, specific, and actionable.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const summary = response.choices[0].message.content;
      console.log('✅ Summary generated successfully');
      return summary;
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      throw error;
    }
  },

  async analyzeDirectRequest(messageText) {
    try {
      console.log('\n🤖 Analyzing direct request...');

      const prompt = `OBI Team (representing external deployment collaborators) has sent this message:

"${messageText}"

Extract and provide:
1. What is being requested or asked
2. Who it's directed to (Eric, Pavan, or both)
3. Level of urgency (low/medium/high)
4. A brief 1-2 sentence summary for a ping message

Format as JSON:
{
  "request": "what is being asked",
  "directed_to": "eric" | "pavan" | "both",
  "urgency": "low" | "medium" | "high",
  "summary": "brief summary"
}`;

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are analyzing requests from a team coordinator. Extract key information accurately.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log('✅ Request analyzed:', analysis);
      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing request:', error);
      // Fallback to simple extraction
      return {
        request: messageText,
        directed_to: 'both',
        urgency: 'medium',
        summary: messageText.substring(0, 100),
      };
    }
  },

  formatPurposeSummary(summary, externalChannelId) {
    // Clean up markdown formatting for Slack
    const cleanSummary = summary
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '') // Remove italic markdown
      .replace(/^- /gm, '• ') // Replace dashes with bullets
      .replace(/^### /gm, '') // Remove heading markers
      .replace(/^## /gm, '') // Remove heading markers
      .replace(/^# /gm, ''); // Remove heading markers

    return `🚀 *External Deployment Team Update* (<#${externalChannelId}>)

${cleanSummary}

📊 Full details available in <#${externalChannelId}>`;
  },

  formatDirectRequestMessage(analysis, obiUserId, ericUserId, pavanUserId) {
    const mentions = [];
    if (analysis.directed_to === 'eric' || analysis.directed_to === 'both') {
      mentions.push(`<@${ericUserId}>`);
    }
    if (analysis.directed_to === 'pavan' || analysis.directed_to === 'both') {
      mentions.push(`<@${pavanUserId}>`);
    }

    const urgencyEmoji = {
      low: '📌',
      medium: '⚡',
      high: '🚨',
    }[analysis.urgency] || '📌';

    return `${mentions.join(' ')} ${urgencyEmoji} **OBI Team needs your help:**

**Request:** ${analysis.summary}

Please respond to help unblock the external deployment team.`;
  },

  getUserName(userId, teamMembers) {
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.display_name || member?.real_name || userId;
  },
};
