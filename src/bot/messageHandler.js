import { messageStore } from '../database/messageStore.js';
import { responseGenerator } from '../ai/responseGenerator.js';
import { contextBuilder } from '../utils/contextBuilder.js';
import { config } from '../config/slack.js';
import { eodSummary } from '../scheduler/eodSummary.js';
import { codePushReminder } from '../scheduler/codePushReminder.js';
import { obiTeamMonitor } from '../monitors/obiTeamMonitor.js';
import { hydrationReminder } from '../scheduler/hydrationReminder.js';
import { jibbleMonitor } from '../monitors/jibbleMonitor.js';
import { dailyCheckin } from '../scheduler/dailyCheckin.js';

export const messageHandler = {
  async handleMessage(message, client) {
    try {
      console.log(`\n🔔 MESSAGE RECEIVED - Channel: ${message.channel}, User: ${message.user}, Thread: ${message.thread_ts || 'none'}, Text: "${message.text?.substring(0, 100)}"`);
      
      // Handle Jibble attendance channel messages (all messages, including bot messages)
      if (message.channel === 'C09GDQ1RX7G') {
        await jibbleMonitor.handleMessage(message, client);
        return;
      }

      // Handle OBI Team external channel messages
      if (message.channel === 'C08UM4WCYAZ') {
        await obiTeamMonitor.handleMessage(message, client);
        return;
      }

      // Check for manual OBI summary trigger in main channel
      if (message.text && message.text.trim().toLowerCase() === '!obi summary') {
        console.log('🧪 Manual OBI summary trigger detected');
        await obiTeamMonitor.handleMessage(message, client);
        return;
      }

      // Only process target channel messages from here on
      if (message.channel !== config.target.channelId) {
        return;
      }

      // Skip messages without user_id (bot messages, system messages, etc.)
      if (!message.user) {
        return;
      }

      if (message.user === config.target.userId) {
        message.is_user_message = true;
      }

      await messageStore.saveMessage(message);
      console.log(`Saved message from ${message.user}: ${message.text?.substring(0, 50)}...`);
      
      // Track activity for hydration reminder system
      hydrationReminder.recordActivity();

      // Track EOD updates for summary
      await eodSummary.trackEODUpdate(message);

      // Track morning check-in responses
      const morningCheckinTs = dailyCheckin.getMorningCheckinTs();
      if (morningCheckinTs && message.thread_ts === morningCheckinTs) {
        const today = new Date().toISOString().split('T')[0];
        const checkin = await messageStore.getCheckinByDate(today, message.user);
        
        if (checkin && !checkin.morning_response_at) {
          await messageStore.saveCheckin({
            date: today,
            userId: message.user,
            morningMessageTs: morningCheckinTs,
            morningResponseAt: new Date(parseFloat(message.ts) * 1000).toISOString(),
            morningResponseText: message.text,
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
            pingCount: checkin.ping_count || 0,
            lastPingAt: checkin.last_ping_at,
            codePushReminderSentAt: checkin.code_push_reminder_sent_at,
            codePushAcknowledgedAt: checkin.code_push_acknowledged_at,
            eodUpdateReceivedAt: checkin.eod_update_received_at,
          });
          console.log(`✅ Tracked morning check-in response from ${message.user}`);
        }
      }

      // Track code push acknowledgments
      const codePushTs = codePushReminder.getCodePushMessageTs();
      if (codePushTs && message.thread_ts === codePushTs) {
        await codePushReminder.trackAcknowledgment(message.user, message.ts);
      }

      // Track Eric/Pavan responses to OBI Team requests
      if (message.thread_ts) {
        await obiTeamMonitor.trackResponse(message, client);
      }

      if (message.bot_id || message.subtype === 'bot_message') {
        return;
      }

      // Check if this is a reply to a thread where bot has participated and contains a question
      let isQuestionInThread = false;
      if (message.thread_ts && message.text) {
        console.log(`🔍 Checking thread reply: "${message.text.substring(0, 100)}"`);
        try {
          // Get all messages in the thread to check if bot has replied
          const threadInfo = await client.conversations.replies({
            channel: message.channel,
            ts: message.thread_ts,
            limit: 100
          });
          
          // Check if any message in the thread is from the bot
          const hasBotReply = threadInfo.messages.some(msg => msg.bot_id);
          
          console.log(`Thread has ${threadInfo.messages.length} messages, bot participated: ${hasBotReply}`);
          
          // Detect if message contains a question (?, "how", "what", "when", "where", "why", "can you", etc.)
          const hasQuestionMark = message.text.includes('?');
          const hasQuestionWord = /\b(how|what|when|where|why|who|which|can you|could you|would you|help|clarify|explain)\b/i.test(message.text);
          
          console.log(`Question detection - hasQuestionMark: ${hasQuestionMark}, hasQuestionWord: ${hasQuestionWord}, hasBotReply: ${hasBotReply}`);
          
          if (hasBotReply && (hasQuestionMark || hasQuestionWord)) {
            isQuestionInThread = true;
            console.log('✅ Question detected in thread where bot participated, will respond proactively');
          } else if (hasQuestionMark || hasQuestionWord) {
            console.log(`⚠️ Question found but bot hasn't participated in thread (hasBotReply: ${hasBotReply})`);
          }
        } catch (error) {
          console.error('❌ Error checking thread:', error);
        }
      }

      const messageType = contextBuilder.detectMessageType(message.text);
      const isEODUpdate = messageType === 'eod_update';
      const isRelevant = contextBuilder.isRelevantForResponse(message, config.target.userId) || isQuestionInThread;
      
      // Skip Antony's messages unless they're questions in bot threads
      if (message.user === config.target.userId && !isQuestionInThread) {
        return;
      }
      
      // Check if message is a simple acknowledgment (e.g., "ok @Antony", "Ok @Antony")
      const isSimpleAck = message.text && /^(ok|okay|sure|got it|noted|understood)\s*(@\w+)?$/i.test(message.text.trim());
      
      if (isSimpleAck && isRelevant) {
        console.log('Simple acknowledgment detected, reacting with thumbs up...');
        try {
          await client.reactions.add({
            channel: message.channel,
            name: 'thumbsup',
            timestamp: message.ts,
          });
          console.log('✅ Added thumbs up reaction');
        } catch (error) {
          console.error('Error adding reaction:', error);
        }
        return;
      }
      
      if (!isRelevant && !isEODUpdate) {
        console.log('Message not relevant for response, skipping...');
        return;
      }

      if (isEODUpdate) {
        console.log('\n📊 End-of-day update detected! Analyzing...');
      } else {
        console.log('\n🤖 Generating response for relevant message...');
      }
      
      let userInfo = null;
      try {
        const userInfoResponse = await client.users.info({ user: message.user });
        userInfo = userInfoResponse.user;
        console.log(`User: <@${message.user}>`);
      } catch (error) {
        console.log('Could not fetch user info:', error.message);
      }
      
      const result = await responseGenerator.generateResponse(message, userInfo);
      
      const shouldAutoSend = await responseGenerator.shouldAutoSend(result.confidence);
      
      if (shouldAutoSend) {
        console.log(`✅ Auto-sending response (confidence: ${result.confidence.toFixed(1)}%)`);
        
        await new Promise(resolve => setTimeout(resolve, config.bot.responseDelay * 1000));
        
        await client.chat.postMessage({
          channel: message.channel,
          text: result.response,
          thread_ts: message.thread_ts || message.ts,
        });
        
        await responseGenerator.logResponse(
          message.ts,
          message.channel,
          result.context,
          result.response,
          result.confidence,
          true,
          new Date().toISOString()
        );
        
        console.log('✅ Response sent successfully!');
      } else {
        console.log(`⚠️  Low confidence (${result.confidence.toFixed(1)}%), sending for manual review...`);
        
        try {
          const dmChannel = await client.conversations.open({
            users: config.target.userId,
          });
          
          await client.chat.postMessage({
            channel: dmChannel.channel.id,
            text: `*Manual Review Needed* (Confidence: ${result.confidence.toFixed(1)}%)\n\n*Original Message:*\n${message.text}\n\n*Suggested Response:*\n${result.response}\n\n*Channel:* <#${message.channel}>\n*Message Type:* ${result.messageType}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Manual Review Needed* (Confidence: ${result.confidence.toFixed(1)}%)`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Original Message:*\n${message.text}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Suggested Response:*\n${result.response}`,
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Channel: <#${message.channel}> | Type: ${result.messageType}`,
                  },
                ],
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Approve & Send',
                    },
                    style: 'primary',
                    value: JSON.stringify({
                      action: 'approve',
                      channel: message.channel,
                      thread_ts: message.thread_ts || message.ts,
                      response: result.response,
                      message_id: message.ts,
                    }),
                    action_id: 'approve_response',
                  },
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Reject',
                    },
                    style: 'danger',
                    value: JSON.stringify({
                      action: 'reject',
                      message_id: message.ts,
                    }),
                    action_id: 'reject_response',
                  },
                ],
              },
            ],
          });
          
          await responseGenerator.logResponse(
            message.ts,
            message.channel,
            result.context,
            result.response,
            result.confidence,
            false,
            null
          );
          
          console.log('📨 Sent to you for manual review');
        } catch (dmError) {
          console.error('Error sending DM for review:', dmError);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  },

  async handleApproval(body, client) {
    try {
      const value = JSON.parse(body.actions[0].value);
      
      if (value.action === 'approve') {
        await client.chat.postMessage({
          channel: value.channel,
          text: value.response,
          thread_ts: value.thread_ts,
        });
        
        await responseGenerator.logResponse(
          value.message_id,
          value.channel,
          '',
          value.response,
          0,
          false,
          new Date().toISOString()
        );
        
        await client.chat.postMessage({
          channel: body.channel.id,
          text: '✅ Response sent successfully!',
          thread_ts: body.message.ts,
        });
      } else if (value.action === 'reject') {
        await client.chat.postMessage({
          channel: body.channel.id,
          text: '❌ Response rejected',
          thread_ts: body.message.ts,
        });
      }
    } catch (error) {
      console.error('Error handling approval:', error);
    }
  },

  async updateTeamMember(userInfo) {
    try {
      await messageStore.saveTeamMember(userInfo);
    } catch (error) {
      console.error('Error updating team member:', error);
    }
  },
};
