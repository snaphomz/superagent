import { messageStore } from '../database/messageStore.js';
import { responseGenerator } from '../ai/responseGenerator.js';
import { contextBuilder } from '../utils/contextBuilder.js';
import { config } from '../config/slack.js';
import { eodSummary } from '../scheduler/eodSummary.js';
import { codePushReminder } from '../scheduler/codePushReminder.js';

export const messageHandler = {
  async handleMessage(message, client) {
    try {
      if (message.channel !== config.target.channelId) {
        return;
      }

      if (message.user === config.target.userId) {
        message.is_user_message = true;
      }

      await messageStore.saveMessage(message);
      console.log(`Saved message from ${message.user}: ${message.text?.substring(0, 50)}...`);

      // Track EOD updates for summary
      await eodSummary.trackEODUpdate(message);

      // Track code push acknowledgments
      const codePushTs = codePushReminder.getCodePushMessageTs();
      if (codePushTs && message.thread_ts === codePushTs) {
        await codePushReminder.trackAcknowledgment(message.user, message.ts);
      }

      if (message.user === config.target.userId) {
        return;
      }

      if (message.bot_id || message.subtype === 'bot_message') {
        return;
      }

      const messageType = contextBuilder.detectMessageType(message.text);
      const isEODUpdate = messageType === 'eod_update';
      const isRelevant = contextBuilder.isRelevantForResponse(message, config.target.userId);
      
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
        const userName = userInfo.profile?.display_name || userInfo.name;
        console.log(`User: ${userName} (${message.user})`);
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
