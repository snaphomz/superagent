import { openai, GPT_MODEL } from '../ai/openaiClient.js';
import { config } from '../config/slack.js';
import { promptBuilder } from './promptBuilder.js';
import { contextBuilder } from '../utils/contextBuilder.js';
import { messageStore } from '../database/messageStore.js';
import { questionGenerator } from './questionGenerator.js';
import { eodDetector } from '../utils/eodDetector.js';
import { yesterdayIST } from '../utils/dateUtils.js';
import db from '../database/postgres.js';
import { learningEngine } from '../learning/learningEngine.js';
import { adaptivePromptBuilder } from '../learning/adaptivePromptBuilder.js';

export const responseGenerator = {
  async generateResponse(message, userInfo = null, options = {}) {
    try {
      const messageType = contextBuilder.detectMessageType(message.text);
      
      const contextString = await contextBuilder.buildContextString(
        message.channel,
        message.ts,
        config.bot.maxContextMessages
      );
      
      let eodContext = null;
      let actualMessageType = messageType;

      // Only run EOD follow-up logic on top-level channel messages, never on thread replies.
      // Thread replies are responses to prior bot questions — re-running EOD detection on them
      // causes the bot to ask the same question repeatedly.
      const isThreadReply = !!message.thread_ts;

      // Also detect if the user is pointing out they already answered
      const alreadyAnswered = message.text && /already\s+(added|written|shared|put|included|mentioned|said|have it|stated|answered)|i\s+have\s+(added|written|shared|put|included)|in\s+(next\s+steps?|my\s+update|the\s+update)/i.test(message.text);

      // Morning check-in thread reply: fetch yesterday's EOD and cross-reference
      const morningCheckinTs = options.morningCheckinTs;
      const isMorningCheckinReply = isThreadReply && morningCheckinTs && message.thread_ts === morningCheckinTs;

      if (isMorningCheckinReply && message.user) {
        try {
          const yesterday = yesterdayIST();
          const eodMsgResult = await db.query(
            `SELECT text FROM messages
             WHERE user_id = $1
               AND channel_id = $2
               AND DATE(to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata') = $3::date
               AND thread_ts IS NULL
               AND LENGTH(text) > 50
             ORDER BY timestamp DESC
             LIMIT 1`,
            [message.user, config.target.channelId, yesterday]
          );
          const prevEodText = eodMsgResult.rows[0]?.text || null;
          if (prevEodText) {
            const prevComponents = eodDetector.extractUpdateComponents(prevEodText);
            const prevAnalysis = eodDetector.analyzeCompleteness(prevComponents);
            actualMessageType = 'morning_checkin';
            eodContext = {
              prevEodText: prevEodText.substring(0, 800),
              prevComponents,
              prevAnalysis,
              todayTasksText: message.text,
            };
            console.log(`📋 Morning check-in with yesterday EOD context for ${message.user}`);
          } else {
            actualMessageType = 'morning_checkin';
            eodContext = { prevEodText: null, todayTasksText: message.text };
            console.log(`📋 Morning check-in (no yesterday EOD found) for ${message.user}`);
          }
        } catch (err) {
          console.error('⚠️ Could not fetch yesterday EOD for check-in context:', err.message);
          actualMessageType = 'morning_checkin';
          eodContext = { prevEodText: null, todayTasksText: message.text };
        }
      } else if (messageType === 'eod_update' && !isThreadReply) {
        eodContext = questionGenerator.getQuestionContext(message.text);
        
        if (eodContext.shouldEngage && eodContext.priority !== 'none') {
          actualMessageType = 'eod_followup';
        }
      } else if (options.answeredQuestions && options.answeredQuestions.length > 0 && isThreadReply) {
        // Bot detected the user answered one or more of its pending questions
        console.log(`💬 Generating acknowledgement for ${options.answeredQuestions.length} answered question(s)`);
        actualMessageType = 'answered_question';
        eodContext = { answeredQuestions: options.answeredQuestions };
      } else if (alreadyAnswered && isThreadReply) {
        // User is pointing back to content they already shared.
        // Re-read the thread parent to verify what's actually there, then confirm specifically.
        console.log('ℹ️ User says they already answered — re-checking thread parent to verify...');
        actualMessageType = 'verified_acknowledgement';

        try {
          const threadInfo = await contextBuilder.client
            ? null // not available here; use options.client below
            : null;
          // client is passed via options if available
          if (options.client && message.thread_ts) {
            const threadData = await options.client.conversations.replies({
              channel: message.channel,
              ts: message.thread_ts,
              limit: 10,
            });
            // The parent message is always the first in the replies array
            const parentMsg = threadData.messages?.[0];
            if (parentMsg && parentMsg.text) {
              const parentComponents = eodDetector.extractUpdateComponents(parentMsg.text);
              const parentAnalysis = eodDetector.analyzeCompleteness(parentComponents);
              // Build a verified context so the prompt can confirm what was found
              eodContext = {
                isEODUpdate: true,
                components: parentComponents,
                analysis: parentAnalysis,
                shouldEngage: false,
                priority: 'none',
                verifiedFromParent: true,
                parentText: parentMsg.text.substring(0, 600),
              };
              console.log(`✅ Verified parent EOD. Remaining issues: ${parentAnalysis.issues.join(', ') || 'none'}`);
            }
          }
        } catch (verifyErr) {
          console.error('⚠️ Could not re-verify thread parent:', verifyErr.message);
        }
      }
      
      // Fetch last 5 bot responses in this channel to avoid repetition
      let recentBotResponses = [];
      try {
        const db = await import('../database/postgres.js');
        const recentResult = await db.default.query(
          `SELECT generated_response FROM response_log
           WHERE channel_id = $1 AND auto_sent = 1
           ORDER BY created_at DESC LIMIT 5`,
          [message.channel]
        );
        recentBotResponses = recentResult.rows.map(r => r.generated_response).filter(Boolean);
      } catch (err) {
        console.error('⚠️ Could not fetch recent responses for dedup:', err.message);
      }

      // Build prompts with learning enhancement
      let systemPrompt;
      try {
        // Try adaptive prompt builder first
        systemPrompt = await adaptivePromptBuilder.buildAdaptiveSystemPrompt(
          config.target.userId,
          message.channel,
          actualMessageType
        );
        console.log('🧠 Using adaptive prompt with learned patterns');
      } catch (error) {
        console.log('⚠️ Falling back to standard prompt builder');
        systemPrompt = await promptBuilder.buildSystemPrompt(config.target.userId, message.channel);
      }

      const userPrompt = await promptBuilder.buildUserPrompt(
        contextString,
        message.text,
        actualMessageType,
        eodContext,
        userInfo,
        recentBotResponses,
        options
      );

      console.log('\n=== Generating Response ===');
      console.log(`Message Type: ${actualMessageType}`);
      if (eodContext) {
        console.log(`EOD Priority: ${eodContext.priority}`);
        console.log(`Issues: ${eodContext.analysis?.issues?.join(', ') ?? 'n/a'}`);
      }
      console.log(`Context Messages: ${contextString.split('\n').length}`);
      
      const completion = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const generatedResponse = completion.choices[0].message.content.trim();
      
      // Predict effectiveness before returning
      const effectiveness = await adaptivePromptBuilder.predictResponseEffectiveness(
        generatedResponse,
        contextString,
        actualMessageType
      );
      
      // Adjust confidence based on predicted effectiveness
      let confidenceScore = this.calculateConfidence(generatedResponse, messageType);
      confidenceScore = (confidenceScore * 0.7) + (effectiveness * 30); // Weight effectiveness
      
      console.log(`Generated Response: "${generatedResponse}"`);
      console.log(`Confidence Score: ${confidenceScore.toFixed(1)}%`);
      console.log(`Predicted Effectiveness: ${(effectiveness * 100).toFixed(1)}%`);
      console.log('===========================\n');

      return {
        response: generatedResponse,
        confidence: confidenceScore,
        messageType: actualMessageType,
        context: contextString,
        eodContext,
        effectiveness,
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  },

  calculateConfidence(response, messageType) {
    let confidence = 70;
    
    if (response.length < 10) {
      confidence -= 20;
    } else if (response.length > 500) {
      confidence -= 10;
    }
    
    if (messageType === 'daily_update' || messageType === 'check_in') {
      confidence += 10;
    }
    
    if (response.includes('I apologize') || response.includes("I'm not sure")) {
      confidence -= 15;
    }
    
    const hasNaturalFlow = !response.includes('As an AI') && 
                          !response.includes('I cannot') &&
                          !response.includes('I am unable');
    
    if (hasNaturalFlow) {
      confidence += 10;
    } else {
      confidence -= 30;
    }
    
    if (response.match(/\b(the|a|an|and|or|but|in|on|at|to|for)\b/gi)) {
      confidence += 5;
    }
    
    return Math.min(100, Math.max(0, confidence));
  },

  async shouldAutoSend(confidence) {
    return confidence >= config.bot.autoSendThreshold;
  },

  async logResponse(messageId, channelId, context, response, confidence, autoSent, sentAt = null) {
    // Log the response
    const responseLog = await messageStore.logResponse({
      messageId,
      channelId,
      context,
      generatedResponse: response,
      confidenceScore: confidence,
      autoSent,
      sentAt,
    });

    // Trigger learning analysis (async, don't wait)
    if (responseLog && responseLog.id) {
      const messageType = contextBuilder.detectMessageType(context.split('\n').pop() || '');
      learningEngine.analyzeResponse(responseLog.id, response, context, messageType)
        .catch(error => console.error('Learning analysis failed:', error));
    }
  },
};
