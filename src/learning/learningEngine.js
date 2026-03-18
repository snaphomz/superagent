import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';

export const learningEngine = {
  // Analyze response patterns and learn from feedback
  async analyzeResponse(responseId, generatedResponse, context, messageType) {
    try {
      const feedback = await feedbackStore.getFeedbackForResponse(responseId);
      
      if (feedback.length === 0) {
        // No feedback yet, can't learn
        return null;
      }

      // Calculate overall success score
      const totalImpact = feedback.reduce((sum, f) => sum + (f.confidence_impact || 0), 0);
      const successScore = Math.max(0, Math.min(1, (totalImpact + feedback.length * 0.2) / (feedback.length * 0.4)));

      // Extract learnable patterns
      const patterns = this.extractPatterns(generatedResponse, context, messageType);
      
      // Save successful patterns
      for (const pattern of patterns) {
        await patternsStore.savePattern(
          pattern.type,
          pattern.key,
          pattern.value,
          successScore
        );
      }

      console.log(`🧠 Learned ${patterns.length} patterns from response (success: ${successScore.toFixed(2)})`);
      
      return {
        successScore,
        patternsLearned: patterns.length,
        feedbackCount: feedback.length
      };
    } catch (error) {
      console.error('Error analyzing response:', error);
      return null;
    }
  },

  // Extract learnable patterns from response
  extractPatterns(response, context, messageType) {
    const patterns = [];

    // Extract response templates for specific message types
    if (messageType === 'eod_update') {
      const eodPatterns = this.extractEODPatterns(response, context);
      patterns.push(...eodPatterns);
    } else if (messageType === 'question') {
      const questionPatterns = this.extractQuestionPatterns(response, context);
      patterns.push(...questionPatterns);
    } else if (messageType === 'task_delegation') {
      const taskPatterns = this.extractTaskPatterns(response, context);
      patterns.push(...taskPatterns);
    }

    // Extract general communication patterns
    const generalPatterns = this.extractGeneralPatterns(response, context);
    patterns.push(...generalPatterns);

    return patterns;
  },

  // Extract EOD response patterns
  extractEODPatterns(response, context) {
    const patterns = [];

    // Look for specific phrases that work well
    if (response.includes('ClickUp')) {
      patterns.push({
        type: 'eod_template',
        key: 'clickup_reminder',
        value: { phrase: 'ClickUp', context: 'eod_confirmation' }
      });
    }

    if (response.includes('tomorrow') || response.includes('next')) {
      patterns.push({
        type: 'eod_template',
        key: 'next_day_planning',
        value: { phrase: 'tomorrow', context: 'future_planning' }
      });
    }

    // Extract specificity patterns
    const specificMentions = response.match(/<@[A-Z0-9]+>/g) || [];
    if (specificMentions.length > 0) {
      patterns.push({
        type: 'specificity_pattern',
        key: 'mention_people',
        value: { count: specificMentions.length, effective: true }
      });
    }

    return patterns;
  },

  // Extract question response patterns
  extractQuestionPatterns(response, context) {
    const patterns = [];

    // Look for direct answer patterns
    if (response.length < 200 && !response.includes('?')) {
      patterns.push({
        type: 'question_template',
        key: 'direct_answer',
        value: { style: 'concise', length: response.length }
      });
    }

    // Look for action-oriented responses
    if (/\b(will|can|should|need to|going to)\b/i.test(response)) {
      patterns.push({
        type: 'question_template',
        key: 'action_response',
        value: { commit: true, phrase: response.match(/\b(will|can|should|need to|going to)\b/i)[0] }
      });
    }

    return patterns;
  },

  // Extract task delegation patterns
  extractTaskPatterns(response, context) {
    const patterns = [];

    // Look for specificity drivers
    if (/\b(what|which|who|when|where)\b/i.test(response)) {
      patterns.push({
        type: 'task_template',
        key: 'specificity_questions',
        value: { asks_details: true, question_words: ['what', 'which', 'who', 'when', 'where'] }
      });
    }

    // Look for deadline mentions
    if (/\b(today|tomorrow|by|end of|deadline)\b/i.test(response)) {
      patterns.push({
        type: 'task_template',
        key: 'deadline_focus',
        value: { mentions_time: true }
      });
    }

    return patterns;
  },

  // Extract general communication patterns
  extractGeneralPatterns(response, context) {
    const patterns = [];

    // Sentence length patterns
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgSentenceLength < 50) {
      patterns.push({
        type: 'style_pattern',
        key: 'short_sentences',
        value: { avg_length: avgSentenceLength, style: 'punchy' }
      });
    }

    // Directness patterns
    const directIndicators = /\b(yes|no|will|can|do|did|done|confirm|acknowledge|noted)\b/i;
    if (directIndicators.test(response)) {
      patterns.push({
        type: 'style_pattern',
        key: 'direct_communication',
        value: { direct: true, indicators: ['yes', 'no', 'will', 'can', 'confirm'] }
      });
    }

    return patterns;
  },

  // Get best practices for specific situations
  async getBestPractices(patternType, context) {
    try {
      const patterns = await patternsStore.getTopPatterns(patternType, 5);
      
      return patterns.map(p => ({
        ...p,
        value: typeof p.value === 'string' ? JSON.parse(p.value) : p.value
      }));
    } catch (error) {
      console.error('Error getting best practices:', error);
      return [];
    }
  },

  // Update pattern success based on new feedback
  async updatePatternSuccess(patternId, feedback) {
    try {
      const success = this.calculateSuccess(feedback);
      return await patternsStore.updatePatternSuccess(patternId, success);
    } catch (error) {
      console.error('Error updating pattern success:', error);
      return null;
    }
  },

  // Calculate success from feedback
  calculateSuccess(feedback) {
    const totalImpact = feedback.reduce((sum, f) => sum + (f.confidence_impact || 0), 0);
    return totalImpact > 0; // Simple success metric
  }
};
