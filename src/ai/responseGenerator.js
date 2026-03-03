import OpenAI from 'openai';
import { config } from '../config/slack.js';
import { promptBuilder } from './promptBuilder.js';
import { contextBuilder } from '../utils/contextBuilder.js';
import { messageStore } from '../database/messageStore.js';
import { questionGenerator } from './questionGenerator.js';
import { eodDetector } from '../utils/eodDetector.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export const responseGenerator = {
  async generateResponse(message, userInfo = null) {
    try {
      const messageType = contextBuilder.detectMessageType(message.text);
      
      const contextString = await contextBuilder.buildContextString(
        message.channel,
        message.ts,
        config.bot.maxContextMessages
      );
      
      let eodContext = null;
      let actualMessageType = messageType;
      
      if (messageType === 'eod_update') {
        eodContext = questionGenerator.getQuestionContext(message.text);
        
        if (eodContext.shouldEngage && eodContext.priority !== 'none') {
          actualMessageType = 'eod_followup';
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

      const prompts = await promptBuilder.buildFullPrompt(
        contextString,
        message.text,
        actualMessageType,
        config.target.userId,
        eodContext,
        userInfo,
        message.channel,
        recentBotResponses
      );

      console.log('\n=== Generating Response ===');
      console.log(`Message Type: ${actualMessageType}`);
      if (eodContext) {
        console.log(`EOD Priority: ${eodContext.priority}`);
        console.log(`Issues: ${eodContext.analysis.issues.join(', ')}`);
      }
      console.log(`Context Messages: ${contextString.split('\n').length}`);
      
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: prompts.system },
          { role: 'user', content: prompts.user },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const generatedResponse = completion.choices[0].message.content.trim();
      
      const confidenceScore = this.calculateConfidence(generatedResponse, messageType);
      
      console.log(`Generated Response: "${generatedResponse}"`);
      console.log(`Confidence Score: ${confidenceScore.toFixed(1)}%`);
      console.log('===========================\n');

      return {
        response: generatedResponse,
        confidence: confidenceScore,
        messageType: actualMessageType,
        context: contextString,
        eodContext,
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
    await messageStore.logResponse({
      messageId,
      channelId,
      context,
      generatedResponse: response,
      confidenceScore: confidence,
      autoSent,
      sentAt,
    });
  },
};
