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
import { setScheduleException } from '../scheduler/checkinValidator.js';
import { pendingQuestions } from '../utils/pendingQuestions.js';
import { todayIST } from '../utils/dateUtils.js';

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

      // Detect file/screenshot shares and save context annotation
      if (message.files && message.files.length > 0) {
        for (const file of message.files) {
          const fileDesc = `[User shared file: ${file.name || 'unnamed'} (${file.filetype || file.mimetype || 'unknown type'})]`;
          try {
            await messageStore.saveMessage({
              ts: `${message.ts}_file_${file.id}`,
              user: message.user,
              channel: message.channel,
              text: fileDesc,
              thread_ts: message.thread_ts || null,
              is_user_message: message.user === config.target.userId,
            });
            console.log(`📎 Saved file annotation: ${fileDesc}`);
          } catch (fileErr) {
            console.error('⚠️ Could not save file annotation:', fileErr.message);
          }
        }
      }

      // Check if this message answers any pending bot questions
      let answeredQuestions = [];
      if (message.thread_ts && message.user && !message.bot_id) {
        answeredQuestions = await pendingQuestions.detectAnswers(message);
        if (answeredQuestions.length > 0) {
          console.log(`💬 ${answeredQuestions.length} pending question(s) answered by ${message.user}`);
        }
      }

      // Parse Note: messages from Antony for schedule exceptions (late start, WFH)
      if (message.user === config.target.userId && message.text) {
        const noteText = message.text;
        if (/^note[:\s]/i.test(noteText.trim())) {
          await this.parseScheduleNote(noteText, client);
        }
      }

      // Track activity for hydration reminder system
      hydrationReminder.recordActivity();

      // Track EOD updates for summary
      await eodSummary.trackEODUpdate(message);

      // Track morning check-in responses
      const morningCheckinTsForTracking = dailyCheckin.getMorningCheckinTs();
      if (morningCheckinTsForTracking && message.thread_ts === morningCheckinTsForTracking) {
        const today = todayIST();
        const checkin = await messageStore.getCheckinByDate(today, message.user);
        
        if (checkin && !checkin.morning_response_at) {
          await messageStore.saveCheckin({
            date: today,
            userId: message.user,
            morningMessageTs: morningCheckinTsForTracking,
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
      console.log(`🔍 Message type: ${messageType}, isEODUpdate: ${isEODUpdate}`);

      // Morning check-in thread replies are always relevant
      const morningTsCheck = dailyCheckin.getMorningCheckinTs();
      const isMorningCheckinReply = !!(morningTsCheck && message.thread_ts === morningTsCheck);

      const isRelevant = contextBuilder.isRelevantForResponse(message, config.target.userId) || isQuestionInThread || isMorningCheckinReply;
      console.log(`🔍 isRelevant: ${isRelevant}, isQuestionInThread: ${isQuestionInThread}, isMorningCheckinReply: ${isMorningCheckinReply}`);

      // Detect program manager (Phani) messages — respond differently
      const PHANI_USER_ID = 'U09KQK8V7ST';
      const isProgramManager = message.user === PHANI_USER_ID;

      // Detect lead @here directives (Eric or Pavan posting team-wide instructions)
      const LEAD_USER_IDS = [
        config.obiTeam.ericUserId,
        config.obiTeam.pavanUserId,
      ].filter(Boolean);
      const isLeadDirective = (
        LEAD_USER_IDS.includes(message.user) &&
        message.text &&
        (message.text.includes('<!here>') || message.text.includes('@here')) &&
        !message.thread_ts // only top-level posts, not thread replies
      );

      if (isLeadDirective) {
        console.log(`👆 Lead directive detected from ${message.user} - reacting with 👍 and reinforcing to team`);
        try {
          await client.reactions.add({
            channel: message.channel,
            name: 'thumbsup',
            timestamp: message.ts,
          });
        } catch (err) {
          console.error('⚠️ Could not add thumbsup reaction:', err.message);
        }
        // Fall through to generate a team-reinforcing response
      }

      // Skip Antony's messages unless they're questions in bot threads OR EOD updates
      if (message.user === config.target.userId && !isQuestionInThread && !isEODUpdate) {
        console.log('⏭️  Skipping Antony\'s message (not a question in thread or EOD update)');
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
      
      console.log(`🔍 Checking relevance: isRelevant=${isRelevant}, isEODUpdate=${isEODUpdate}`);
      
      if (!isRelevant && !isEODUpdate) {
        console.log('Message not relevant for response, skipping...');
        return;
      }

      if (isEODUpdate) {
        console.log('\n📊 End-of-day update detected! Analyzing...');
      } else {
        console.log('\n🤖 Generating response for relevant message...');
      }
      
      console.log('🔄 About to call responseGenerator.generateResponse...');
      
      // Wrap response generation in try-catch to catch any errors
      try {
        let userInfo = null;
        try {
          const userInfoResponse = await client.users.info({ user: message.user });
          userInfo = userInfoResponse.user;
          console.log(`User: <@${message.user}>`);
        } catch (error) {
          console.log('Could not fetch user info:', error.message);
        }
        
        const morningCheckinTs = dailyCheckin.getMorningCheckinTs();
        console.log('🔄 Calling responseGenerator.generateResponse...');
        const result = await responseGenerator.generateResponse(message, userInfo, { isLeadDirective, isProgramManager, client, answeredQuestions, morningCheckinTs });
        
        console.log(`✅ Response generated: "${result.response?.substring(0, 50)}..." (confidence: ${result.confidence})`);
        
        const shouldAutoSend = await responseGenerator.shouldAutoSend(result.confidence);
        
        if (shouldAutoSend) {
          console.log(`✅ Auto-sending response (confidence: ${result.confidence.toFixed(1)}%)`);
        
        await new Promise(resolve => setTimeout(resolve, config.bot.responseDelay * 1000));
        
        const sentMsg = await client.chat.postMessage({
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

        // Track any questions the bot asked so we can detect when they get answered
        if (message.user && result.response && result.response.includes('?')) {
          const threadTs = message.thread_ts || message.ts;
          const targetUserId = message.user;
          // Extract questions from the bot response (sentences ending in ?)
          const questionSentences = result.response
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().endsWith('?'))
            .slice(0, 3); // max 3 questions to track
          for (const q of questionSentences) {
            try {
              await pendingQuestions.saveQuestion({
                channelId: message.channel,
                threadTs,
                userId: targetUserId,
                botMessageTs: sentMsg.ts,
                questionText: q.trim(),
                questionType: result.messageType,
              });
            } catch (qErr) {
              console.error('⚠️ Could not save pending question:', qErr.message);
            }
          }
        }

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
      
      } catch (responseError) {
        console.error('❌ Error generating response:', responseError);
        console.error('Stack trace:', responseError.stack);
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

  async parseScheduleNote(noteText, client) {
    try {
      // Extract all mentioned user IDs from the note: <@U12345>
      const mentionRegex = /<@([A-Z0-9]+)>/g;
      let match;
      const mentionedUsers = [];
      while ((match = mentionRegex.exec(noteText)) !== null) {
        mentionedUsers.push(match[1]);
      }

      if (mentionedUsers.length === 0) return;

      // Detect late start time: "start work after 6 PM", "starts at 6pm", "6 PM start"
      const lateStartMatch = noteText.match(/(?:start(?:s)?\s+(?:work\s+)?(?:after|at)\s+|after\s+)(\d{1,2})\s*(?:PM|pm|AM|am)?/i);
      let lateStartHour = null;
      if (lateStartMatch) {
        lateStartHour = parseInt(lateStartMatch[1]);
        // Assume PM if hour <= 11 and context says PM or typical working hours
        if (lateStartHour < 12 && /pm/i.test(lateStartMatch[0])) {
          lateStartHour += 12;
        }
      }

      // Detect WFH (working from home — treat as normal working hours, no late start)
      const isWFH = /\bwfh\b/i.test(noteText);

      for (const userId of mentionedUsers) {
        if (lateStartHour) {
          setScheduleException(userId, { lateStart: lateStartHour, wfh: isWFH });
          console.log(`📋 Note parsed: ${userId} has late start at ${lateStartHour}:00 IST`);
        } else if (isWFH) {
          // WFH only — no ping change needed, just log
          console.log(`📋 Note parsed: ${userId} is WFH today (normal schedule)`);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing schedule note:', error);
    }
  },
};
