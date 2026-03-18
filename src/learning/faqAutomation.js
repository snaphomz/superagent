import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';
import { learningEngine } from './learningEngine.js';

export const faqAutomation = {
  // Extract and store FAQ patterns
  async extractFAQPatterns(responses, feedback) {
    try {
      const faqPatterns = await this.identifyFAQPatterns(responses, feedback);
      
      for (const pattern of faqPatterns) {
        await this.storeFAQPattern(pattern);
      }
      
      console.log(`📚 Extracted ${faqPatterns.length} FAQ patterns`);
      return faqPatterns;
    } catch (error) {
      console.error('Error extracting FAQ patterns:', error);
      return [];
    }
  },

  // Identify FAQ patterns from responses
  async identifyFAQPatterns(responses, feedback) {
    const patterns = [];
    const questions = new Map();
    
    // Group similar questions
    responses.forEach((response, index) => {
      const questionType = this.detectQuestionType(response);
      if (questionType) {
        const key = this.normalizeQuestion(response);
        
        if (!questions.has(key)) {
          questions.set(key, {
            question: key,
            questionType,
            responses: [],
            feedback: [],
            examples: []
          });
        }
        
        const questionData = questions.get(key);
        questionData.responses.push(response);
        questionData.feedback.push(feedback[index] || {});
        questionData.examples.push({
          response,
          feedback: feedback[index] || {},
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Analyze each question pattern
    for (const [key, data] of questions) {
      if (data.responses.length >= 3) { // Need at least 3 examples
        const pattern = await this.analyzeFAQPattern(data);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  },

  // Detect if a message is a question
  detectQuestionType(text) {
    const lowerText = text.toLowerCase();
    
    // Common question patterns
    const questionPatterns = {
      'how_to': /\b(how to|how do i|how can i)\b/,
      'what_is': /\b(what is|what does|what are)\b/,
      'when': /\b(when|what time|what day)\b/,
      'where': /\b(where|what location)\b/,
      'who': /\b(who is|who are|which person)\b/,
      'why': /\b(why|what reason)\b/,
      'which': /\b(which one|what option)\b/,
      'can_you': /\b(can you|could you|will you)\b/,
      'should': /\b(should i|should we)\b/,
      'is_there': /\b(is there|are there)\b/
    };
    
    for (const [type, pattern] of Object.entries(questionPatterns)) {
      if (pattern.test(lowerText)) {
        return type;
      }
    }
    
    // Generic question detection
    if (text.includes('?')) {
      return 'general';
    }
    
    return null;
  },

  // Normalize question for grouping
  normalizeQuestion(text) {
    let normalized = text.toLowerCase();
    
    // Remove common variations
    normalized = normalized.replace(/\b(how do i|how can i)\b/g, 'how to');
    normalized = normalized.replace(/\b(what is|what does)\b/g, 'what is');
    normalized = normalized.replace(/\b(can you|could you)\b/g, 'can you');
    
    // Remove specific details
    normalized = normalized.replace(/\b[a-z0-9]+@[a-z0-9.]+\.[a-z]{2,}/gi, '[email]');
    normalized = normalized.replace(/\bhttps?:\/\/[^\s]+/gi, '[url]');
    normalized = normalized.replace(/\b\d+\b/g, '[number]');
    
    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  },

  // Analyze FAQ pattern
  async analyzeFAQPattern(data) {
    const successRate = this.calculateSuccessRate(data.feedback);
    
    if (successRate < 0.6) {
      return null; // Only keep successful patterns
    }
    
    // Find the best response
    const bestResponse = this.findBestResponse(data);
    
    // Extract key entities
    const entities = this.extractEntities(data.responses);
    
    return {
      question: data.question,
      questionType: data.questionType,
      bestResponse: bestResponse.text,
      responseTemplate: this.createTemplate(bestResponse.text),
      entities: entities,
      successRate: successRate,
      usageCount: data.responses.length,
      examples: data.examples.slice(0, 3), // Keep top 3 examples
      lastUpdated: new Date().toISOString()
    };
  },

  // Calculate success rate for FAQ pattern
  calculateSuccessRate(feedback) {
    if (feedback.length === 0) return 0.5;
    
    const totalImpact = feedback.reduce((sum, f) => sum + (f.confidence_impact || 0), 0);
    return (totalImpact / feedback.length + 1) / 2; // Normalize to 0-1
  },

  // Find best response from examples
  findBestResponse(data) {
    let bestIndex = 0;
    let bestScore = -1;
    
    data.responses.forEach((response, index) => {
      const feedback = data.feedback[index] || {};
      const score = feedback.confidence_impact || 0;
      
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    
    return {
      text: data.responses[bestIndex],
      feedback: data.feedback[bestIndex],
      score: bestScore
    };
  },

  // Create response template
  createTemplate(response) {
    let template = response;
    
    // Replace specific values with placeholders
    template = template.replace(/\b[a-z0-9]+@[a-z0-9.]+\.[a-z]{2,}/gi, '{email}');
    template = template.replace(/\bhttps?:\/\/[^\s]+/gi, '{url}');
    template = template.replace(/\b\d+\b/g, '{number}');
    
    // Replace user mentions with placeholder
    template = template.replace(/<@[A-Z0-9]+>/g, '{user}');
    
    return template;
  },

  // Extract entities from responses
  extractEntities(responses) {
    const entities = {
      users: new Set(),
      topics: new Set(),
      actions: new Set(),
      resources: new Set()
    };
    
    responses.forEach(response => {
      // Extract user mentions
      const mentions = response.match(/<@[A-Z0-9]+>/g) || [];
      mentions.forEach(m => entities.users.add(m));
      
      // Extract topics
      const topicKeywords = ['clickup', 'github', 'slack', 'deploy', 'test', 'review', 'meeting'];
      topicKeywords.forEach(topic => {
        if (response.toLowerCase().includes(topic)) {
          entities.topics.add(topic);
        }
      });
      
      // Extract actions
      const actionKeywords = ['update', 'create', 'delete', 'review', 'approve', 'deploy', 'test'];
      actionKeywords.forEach(action => {
        if (response.toLowerCase().includes(action)) {
          entities.actions.add(action);
        }
      });
      
      // Extract resources
      const resourceKeywords = ['link', 'document', 'file', 'branch', 'pr', 'issue'];
      resourceKeywords.forEach(resource => {
        if (response.toLowerCase().includes(resource)) {
          entities.resources.add(resource);
        }
      });
    });
    
    // Convert sets to arrays
    Object.keys(entities).forEach(key => {
      entities[key] = Array.from(entities[key]);
    });
    
    return entities;
  },

  // Store FAQ pattern
  async storeFAQPattern(pattern) {
    try {
      await patternsStore.savePattern(
        'faq_pattern',
        pattern.question,
        pattern,
        pattern.successRate
      );
    } catch (error) {
      console.error('Error storing FAQ pattern:', error);
    }
  },

  // Get FAQ answer for a question
  async getFAQAnswer(question) {
    try {
      const normalizedQuestion = this.normalizeQuestion(question);
      const pattern = await patternsStore.getPattern('faq_pattern', normalizedQuestion);
      
      if (pattern && pattern.successRate > 0.7) {
        const patternData = typeof pattern.value === 'string' ? JSON.parse(pattern.value) : pattern.value;
        return {
          answer: this.fillTemplate(patternData.responseTemplate, question),
          confidence: patternData.successRate,
          questionType: patternData.questionType,
          entities: patternData.entities
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting FAQ answer:', error);
      return null;
    }
  },

  // Fill template with current context
  fillTemplate(template, question) {
    let filled = template;
    
    // Try to extract entities from the question
    const emailMatch = question.match(/\b[a-z0-9]+@[a-z0-9.]+\.[a-z]{2,}/gi);
    if (emailMatch) {
      filled = filled.replace(/{email}/g, emailMatch[0]);
    }
    
    const urlMatch = question.match(/\bhttps?:\/\/[^\s]+/gi);
    if (urlMatch) {
      filled = filled.replace(/{url}/g, urlMatch[0]);
    }
    
    const numberMatch = question.match(/\b\d+\b/g);
    if (numberMatch) {
      filled = filled.replace(/{number}/g, numberMatch[0]);
    }
    
    const userMatch = question.match(/<@[A-Z0-9]+>/g);
    if (userMatch) {
      filled = filled.replace(/{user}/g, userMatch[0]);
    }
    
    return filled;
  },

  // Get all FAQ patterns
  async getAllFAQs() {
    try {
      const patterns = await patternsStore.getTopPatterns('faq_pattern', 50);
      return patterns.map(p => ({
        ...p,
        value: typeof p.value === 'string' ? JSON.parse(p.value) : p.value
      }));
    } catch (error) {
      console.error('Error getting all FAQs:', error);
      return [];
    }
  },

  // Update FAQ pattern with new feedback
  async updateFAQPattern(question, feedback) {
    try {
      const normalizedQuestion = this.normalizeQuestion(question);
      const pattern = await patternsStore.getPattern('faq_pattern', normalizedQuestion);
      
      if (pattern) {
        const success = feedback.confidence_impact > 0;
        await patternsStore.updatePatternSuccess(pattern.id, success);
        
        console.log(`📚 Updated FAQ pattern for: "${normalizedQuestion}" (success: ${success})`);
      }
    } catch (error) {
      console.error('Error updating FAQ pattern:', error);
    }
  },

  // Get FAQ statistics
  async getFAQStats() {
    try {
      const allFAQs = await this.getAllFAQs();
      
      const stats = {
        totalPatterns: allFAQs.length,
        byType: {},
        averageSuccessRate: 0,
        mostUsed: null,
        highestSuccess: null
      };
      
      if (allFAQs.length > 0) {
        // Calculate by type
        allFAQs.forEach(faq => {
          const type = faq.value.questionType;
          if (!stats.byType[type]) {
            stats.byType[type] = { count: 0, totalSuccess: 0 };
          }
          stats.byType[type].count++;
          stats.byType[type].totalSuccess += faq.success_rate;
        });
        
        // Calculate average success rate
        stats.averageSuccessRate = allFAQs.reduce((sum, faq) => sum + faq.success_rate, 0) / allFAQs.length;
        
        // Find most used
        stats.mostUsed = allFAQs.reduce((max, faq) => faq.usage_count > (max?.usage_count || 0) ? faq : max, null);
        
        // Find highest success
        stats.highestSuccess = allFAQs.reduce((max, faq) => faq.success_rate > (max?.success_rate || 0) ? faq : max, null);
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting FAQ stats:', error);
      return null;
    }
  }
};
