import { patternsStore } from './patternsStore.js';
import { learningEngine } from './learningEngine.js';
import { config } from '../config/slack.js';

export const adaptivePromptBuilder = {
  // Build enhanced system prompt with learned patterns
  async buildAdaptiveSystemPrompt(userId, channelId = null, messageType = null) {
    const basePrompt = await this.getBaseSystemPrompt(userId, channelId);
    
    // Get relevant learned patterns
    const learnedPatterns = await this.getRelevantPatterns(messageType, userId);
    
    if (learnedPatterns.length === 0) {
      return basePrompt;
    }
    
    // Build adaptive enhancements
    const enhancements = this.buildPatternEnhancements(learnedPatterns, messageType);
    
    return `${basePrompt}

## Learned Communication Patterns (Antony's Evolution)

${enhancements}

## Learning Guidelines
- Apply these patterns ONLY when they enhance delivery and clarity
- NEVER compromise core principles (certainty, directness, execution focus)
- If a pattern conflicts with core principles, prioritize principles
- Maintain Antony's CTO persona at all times`;
  },

  // Get base system prompt (existing implementation)
  async getBaseSystemPrompt(userId, channelId) {
    const { promptBuilder } = await import('../ai/promptBuilder.js');
    return await promptBuilder.buildSystemPrompt(userId, channelId);
  },

  // Get patterns relevant to current context
  async getRelevantPatterns(messageType, userId) {
    const patterns = [];
    
    // Get style patterns that work well
    const stylePatterns = await patternsStore.getTopPatterns('style_pattern', 5);
    patterns.push(...stylePatterns.filter(p => p.success_rate > 0.6));
    
    // Get message-type specific patterns
    if (messageType) {
      const typePatterns = await patternsStore.getTopPatterns(`${messageType}_template`, 3);
      patterns.push(...typePatterns.filter(p => p.success_rate > 0.5));
    }
    
    // Get specificity patterns
    const specificityPatterns = await patternsStore.getTopPatterns('specificity_pattern', 3);
    patterns.push(...specificityPatterns.filter(p => p.success_rate > 0.7));
    
    return patterns.map(p => ({
      ...p,
      value: typeof p.value === 'string' ? JSON.parse(p.value) : p.value
    }));
  },

  // Build pattern enhancements for prompt
  buildPatternEnhancements(patterns, messageType) {
    const enhancements = [];
    
    // Style patterns
    const stylePatterns = patterns.filter(p => p.pattern_type === 'style_pattern');
    if (stylePatterns.length > 0) {
      enhancements.push('### Communication Style Enhancements:');
      
      stylePatterns.forEach(p => {
        if (p.pattern_key === 'short_sentences') {
          enhancements.push(`- **Effective sentence length**: Average ${p.value.avg_length.toFixed(0)} characters (punchy, direct)`);
        } else if (p.pattern_key === 'direct_communication') {
          enhancements.push(`- **Direct indicators**: Use words like ${p.value.indicators.join(', ')} for clarity`);
        }
      });
    }
    
    // Specificity patterns
    const specificityPatterns = patterns.filter(p => p.pattern_type === 'specificity_pattern');
    if (specificityPatterns.length > 0) {
      enhancements.push('\n### Specificity Enhancements:');
      specificityPatterns.forEach(p => {
        if (p.pattern_key === 'mention_people') {
          enhancements.push(`- **People mentions**: Reference ${p.value.count} specific people when relevant (proven effective)`);
        }
      });
    }
    
    // Message type patterns
    const typePatterns = patterns.filter(p => p.pattern_type.includes('_template'));
    if (typePatterns.length > 0) {
      enhancements.push(`\n### ${messageType?.toUpperCase() || 'RESPONSE'} Patterns:`);
      
      typePatterns.forEach(p => {
        if (p.pattern_key === 'clickup_reminder') {
          enhancements.push(`- **ClickUp confirmation**: Mention ClickUp for EOD updates (success rate: ${(p.success_rate * 100).toFixed(1)}%)`);
        } else if (p.pattern_key === 'direct_answer') {
          enhancements.push(`- **Answer style**: Keep responses concise (${p.value.style}, avg ${p.value.length} chars)`);
        } else if (p.pattern_key === 'specificity_questions') {
          enhancements.push(`- **Clarity questions**: Ask ${p.value.question_words.join(', ')} for task details`);
        }
      });
    }
    
    return enhancements.join('\n');
  },

  // Predict response effectiveness before sending
  async predictResponseEffectiveness(response, context, messageType) {
    try {
      let score = 0.5; // Base score
      
      // Check against learned patterns
      const patterns = await this.getRelevantPatterns(messageType);
      
      patterns.forEach(pattern => {
        if (this.matchesPattern(response, pattern)) {
          score += pattern.success_rate * 0.2;
        }
      });
      
      // Antony's core principles check
      score += this.checkCorePrinciples(response) * 0.3;
      
      // Specificity check
      const specificity = this.calculateSpecificity(response);
      score += specificity * 0.2;
      
      // Normalize to 0-1
      return Math.min(1, Math.max(0, score));
    } catch (error) {
      console.error('Error predicting response effectiveness:', error);
      return 0.5;
    }
  },

  // Check if response matches a learned pattern
  matchesPattern(response, pattern) {
    const text = response.toLowerCase();
    
    if (pattern.pattern_key === 'short_sentences') {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      return avgLength <= pattern.value.avg_length + 20;
    }
    
    if (pattern.pattern_key === 'direct_communication') {
      return pattern.value.indicators.some(word => text.includes(word));
    }
    
    if (pattern.pattern_key === 'clickup_reminder') {
      return text.includes('clickup');
    }
    
    if (pattern.pattern_key === 'mention_people') {
      const mentions = response.match(/<@[A-Z0-9]+>/g) || [];
      return mentions.length >= pattern.value.count;
    }
    
    return false;
  },

  // Check adherence to Antony's core principles
  checkCorePrinciples(response) {
    let score = 0;
    const text = response.toLowerCase();
    
    // Certainty and directness
    if (/\b(yes|no|will|can|confirm|acknowledge|noted|certainly|definitely)\b/i.test(response)) {
      score += 0.3;
    }
    
    // No false hopes
    if (!/\b(maybe|possibly|probably|might|could be|perhaps)\b/i.test(response)) {
      score += 0.2;
    }
    
    // Execution focus
    if (/\b(will do|going to|action|deliver|execute|implement|complete)\b/i.test(response)) {
      score += 0.3;
    }
    
    // No wellness mentions
    if (!/\b(water|hydrate|break|rest|wellness|health)\b/i.test(response)) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  },

  // Calculate specificity score
  calculateSpecificity(response) {
    let score = 0;
    
    // Mentions specific people
    const mentions = response.match(/<@[A-Z0-9]+>/g) || [];
    if (mentions.length > 0) {
      score += 0.3;
    }
    
    // Mentions specific tasks/actions
    if (/\b(test|deploy|review|fix|implement|create|update|build)\b/i.test(response)) {
      score += 0.3;
    }
    
    // Mentions deadlines/timeframes
    if (/\b(today|tomorrow|by|end of|deadline|asap)\b/i.test(response)) {
      score += 0.2;
    }
    
    // Avoids generic phrases
    const genericPhrases = ['team is doing', 'everything looks good', 'no issues', 'on track'];
    if (!genericPhrases.some(phrase => response.toLowerCase().includes(phrase))) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  },

  // Suggest improvements for low-confidence responses
  async suggestImprovements(response, context, messageType) {
    const suggestions = [];
    const effectiveness = await this.predictResponseEffectiveness(response, context, messageType);
    
    if (effectiveness < 0.7) {
      // Check core principles
      const principlesScore = this.checkCorePrinciples(response);
      if (principlesScore < 0.7) {
        suggestions.push('Be more direct and certain - avoid tentative language');
      }
      
      // Check specificity
      const specificity = this.calculateSpecificity(response);
      if (specificity < 0.5) {
        suggestions.push('Add specific people, tasks, or deadlines');
      }
      
      // Check against successful patterns
      const patterns = await this.getRelevantPatterns(messageType);
      const matchingPatterns = patterns.filter(p => this.matchesPattern(response, p));
      
      if (matchingPatterns.length < patterns.length / 2) {
        suggestions.push('Consider using proven response patterns');
      }
    }
    
    return suggestions;
  }
};
