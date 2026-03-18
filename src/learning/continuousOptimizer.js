import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';
import { userProfileLearner } from './userProfileLearner.js';
import { contextOptimizer } from './contextOptimizer.js';
import { faqAutomation } from './faqAutomation.js';
import { learningEngine } from './learningEngine.js';

export const continuousOptimizer = {
  // Run continuous optimization cycle
  async runOptimizationCycle(channelId) {
    try {
      console.log('🔄 Starting continuous optimization cycle...');
      
      const results = {
        timestamp: new Date().toISOString(),
        optimizations: [],
        performance: {},
        nextActions: []
      };
      
      // 1. Pattern optimization
      const patternOpt = await this.optimizePatterns();
      if (patternOpt) {
        results.optimizations.push(patternOpt);
      }
      
      // 2. User profile updates
      const profileOpt = await this.updateUserProfiles(channelId);
      if (profileOpt) {
        results.optimizations.push(profileOpt);
      }
      
      // 3. Context weight tuning
      const contextOpt = await this.tuneContextWeights(channelId);
      if (contextOpt) {
        results.optimizations.push(contextOpt);
      }
      
      // 4. FAQ pattern refinement
      const faqOpt = await this.refineFAQPatterns(channelId);
      if (faqOpt) {
        results.optimizations.push(faqOpt);
      }
      
      // 5. Performance analysis
      results.performance = await this.analyzePerformance(channelId);
      
      // 6. Generate next actions
      results.nextActions = await this.generateNextActions(results);
      
      console.log(`✅ Optimization complete: ${results.optimizations.length} optimizations applied`);
      
      return results;
    } catch (error) {
      console.error('Error in optimization cycle:', error);
      return null;
    }
  },

  // Optimize patterns based on performance
  async optimizePatterns() {
    try {
      const patterns = await patternsStore.getTopPatterns('style_pattern', 50);
      const optimizations = [];
      
      for (const pattern of patterns) {
        if (pattern.usage_count >= 10 && pattern.success_rate < 0.5) {
          // Low-performing pattern with enough data
          const improvement = await this.suggestPatternImprovement(pattern);
          if (improvement) {
            optimizations.push(improvement);
          }
        }
      }
      
      return {
        type: 'pattern_optimization',
        count: optimizations.length,
        details: optimizations
      };
    } catch (error) {
      console.error('Error optimizing patterns:', error);
      return null;
    }
  },

  // Update user profiles with recent data
  async updateUserProfiles(channelId) {
    try {
      // Get recent user interactions
      const messages = await messageStore.getChannelMessages(channelId, 100);
      const recentMessages = messages.filter(msg => msg.is_user_message && msg.user_id);
      
      const userGroups = {};
      recentMessages.forEach(msg => {
        if (!userGroups[msg.user_id]) userGroups[msg.user_id] = [];
        userGroups[msg.user_id].push(msg);
      });
      
      const updatedProfiles = [];
      
      for (const [userId, userMessages] of Object.entries(userGroups)) {
        if (userMessages.length >= 5) { // Only update with sufficient data
          // Get feedback for user's recent interactions
          const feedback = await this.getUserFeedback(userId, userMessages);
          
          // Update user profile
          const profile = await userProfileLearner.learnUserPreferences(userId, userMessages, feedback);
          if (profile) {
            updatedProfiles.push(userId);
          }
        }
      }
      
      return {
        type: 'user_profile_update',
        count: updatedProfiles.length,
        users: updatedProfiles
      };
    } catch (error) {
      console.error('Error updating user profiles:', error);
      return null;
    }
  },

  // Tune context weights based on effectiveness
  async tuneContextWeights(channelId) {
    try {
      // Train context optimizer with recent data
      const updatedWeights = await contextOptimizer.trainWithRecentData(7);
      
      if (updatedWeights) {
        return {
          type: 'context_weight_tuning',
          weights: updatedWeights,
          improvements: this.identifyWeightImprovements(updatedWeights)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error tuning context weights:', error);
      return null;
    }
  },

  // Refine FAQ patterns
  async refineFAQPatterns(channelId) {
    try {
      // Get recent questions and responses
      const messages = await messageStore.getChannelMessages(channelId, 100);
      const questions = messages.filter(msg => 
        msg.is_user_message && msg.text && msg.text.includes('?')
      );
      
      if (questions.length >= 5) {
        // Get responses to these questions
        const responses = await this.getQuestionResponses(questions);
        const feedback = await this.getQuestionFeedback(questions);
        
        // Extract and update FAQ patterns
        const patterns = await faqAutomation.extractFAQPatterns(responses, feedback);
        
        return {
          type: 'faq_refinement',
          newPatterns: patterns.length,
          details: patterns.slice(0, 3) // Show top 3 new patterns
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error refining FAQ patterns:', error);
      return null;
    }
  },

  // Analyze overall performance
  async analyzePerformance(channelId) {
    try {
      const recentLogs = await messageStore.getResponseLogs(50);
      const recentFeedback = await feedbackStore.getFeedbackPatterns(100);
      
      const performance = {
        avgConfidence: recentLogs.length > 0 
          ? recentLogs.reduce((sum, log) => sum + (log.confidence_score || 0), 0) / recentLogs.length
          : 0,
        autoSentRate: recentLogs.length > 0
          ? recentLogs.filter(log => log.auto_sent).length / recentLogs.length
          : 0,
        feedbackScore: recentFeedback.length > 0
          ? recentFeedback.reduce((sum, f) => sum + (f.avg_impact || 0), 0) / recentFeedback.length
          : 0,
        patternSuccess: await this.calculatePatternSuccess(),
        userSatisfaction: await this.calculateUserSatisfaction(channelId)
      };
      
      return performance;
    } catch (error) {
      console.error('Error analyzing performance:', error);
      return null;
    }
  },

  // Generate next actions
  async generateNextActions(results) {
    const actions = [];
    
    // Based on performance
    if (results.performance && results.performance.avgConfidence < 70) {
      actions.push({
        priority: 'high',
        action: 'Review low-confidence responses',
        reason: 'Average confidence below 70%',
        effort: 'medium'
      });
    }
    
    // Based on optimizations
    if (results.optimizations.length > 0) {
      const patternOpts = results.optimizations.filter(opt => opt.type === 'pattern_optimization');
      if (patternOpts.length > 0) {
        actions.push({
          priority: 'medium',
          action: 'Update response templates',
          reason: `${patternOpts[0].count} patterns need improvement`,
          effort: 'low'
        });
      }
    }
    
    // Based on user profiles
    const profileOpts = results.optimizations.find(opt => opt.type === 'user_profile_update');
    if (profileOpts && profileOpts.count > 0) {
      actions.push({
        priority: 'low',
        action: 'Monitor user adaptation',
        reason: `${profileOpts.count} user profiles updated`,
        effort: 'low'
      });
    }
    
    // Proactive suggestions
    actions.push({
      priority: 'low',
      action: 'Schedule next optimization cycle',
      reason: 'Continuous improvement',
      effort: 'automatic'
    });
    
    return actions;
  },

  // Helper methods
  async suggestPatternImprovement(pattern) {
    const improvements = [];
    
    if (pattern.success_rate < 0.3) {
      improvements.push({
        pattern: pattern.pattern_key,
        issue: 'Very low success rate',
        suggestion: 'Consider replacing this pattern',
        action: 'review_and_replace'
      });
    } else if (pattern.success_rate < 0.5) {
      improvements.push({
        pattern: pattern.pattern_key,
        issue: 'Low success rate',
        suggestion: 'Modify or refine this pattern',
        action: 'refine_pattern'
      });
    }
    
    return improvements.length > 0 ? improvements[0] : null;
  },

  async getUserFeedback(userId, messages) {
    // Get feedback for user's messages
    const feedback = [];
    
    for (const msg of messages) {
      const msgFeedback = await feedbackStore.getFeedbackForResponse(msg.ts);
      feedback.push(...msgFeedback);
    }
    
    return feedback;
  },

  async getQuestionResponses(questions) {
    // This would need to be implemented to get bot responses to questions
    // For now, return empty array
    return [];
  },

  async getQuestionFeedback(questions) {
    // Get feedback for question responses
    const feedback = [];
    
    for (const question of questions) {
      const qFeedback = await feedbackStore.getFeedbackForResponse(question.ts);
      feedback.push(...qFeedback);
    }
    
    return feedback;
  },

  identifyWeightImprovements(weights) {
    const improvements = [];
    
    // Identify significant weight changes
    Object.entries(weights).forEach(([key, weight]) => {
      if (typeof weight === 'number') {
        if (weight > 1.5) {
          improvements.push({
            component: key,
            change: 'increased',
            value: weight,
            reason: 'High importance detected'
          });
        } else if (weight < 0.5) {
          improvements.push({
            component: key,
            change: 'decreased',
            value: weight,
            reason: 'Low importance detected'
          });
        }
      }
    });
    
    return improvements;
  },

  async calculatePatternSuccess() {
    const patterns = await patternsStore.getTopPatterns('style_pattern', 50);
    
    if (patterns.length === 0) return 0;
    
    const totalSuccess = patterns.reduce((sum, p) => sum + p.success_rate, 0);
    return (totalSuccess / patterns.length * 100).toFixed(1);
  },

  async calculateUserSatisfaction(channelId) {
    // Simplified satisfaction calculation based on feedback
    const feedback = await feedbackStore.getFeedbackPatterns(100);
    
    if (feedback.length === 0) return 0;
    
    const positiveFeedback = feedback.filter(f => f.avg_impact > 0);
    return (positiveFeedback.length / feedback.length * 100).toFixed(1);
  },

  // Schedule automatic optimization
  scheduleAutomaticOptimization(client, channelId) {
    // Run every 24 hours
    setInterval(async () => {
      console.log('🔄 Running automatic optimization...');
      const results = await this.runOptimizationCycle(channelId);
      
      if (results && results.performance) {
        // Send summary to Antony if performance is concerning
        if (results.performance.avgConfidence < 60 || results.performance.feedbackScore < -0.1) {
          await client.chat.postMessage({
            channel: 'U09KQK8V7ST', // Antony's user ID
            text: `⚠️ *Performance Alert*\n\nBot performance needs attention:\n• Confidence: ${results.performance.avgConfidence.toFixed(1)}%\n• Feedback Score: ${results.performance.feedbackScore.toFixed(2)}\n\nOptimization completed with ${results.optimizations.length} improvements.`
          });
        }
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    console.log('🤖 Automatic optimization scheduled (every 24 hours)');
  }
};
