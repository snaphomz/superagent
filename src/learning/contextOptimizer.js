import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';

export const contextOptimizer = {
  // Learn optimal context weights for different situations
  async learnContextWeights(contexts, outcomes) {
    try {
      const weights = await this.getCurrentWeights();
      
      // Analyze which context elements correlate with success
      const analysis = this.analyzeContextEffectiveness(contexts, outcomes);
      
      // Update weights based on analysis
      const updatedWeights = this.updateWeights(weights, analysis);
      
      // Save the updated weights
      await this.saveWeights(updatedWeights);
      
      console.log('⚖️ Updated context weights:');
      Object.entries(updatedWeights).forEach(([key, weight]) => {
        console.log(`  ${key}: ${weight.toFixed(2)}`);
      });
      
      return updatedWeights;
    } catch (error) {
      console.error('Error learning context weights:', error);
      return null;
    }
  },

  // Get current context weights
  async getCurrentWeights() {
    try {
      const pattern = await patternsStore.getPattern('context_weights', 'global');
      if (pattern) {
        return typeof pattern.value === 'string' ? JSON.parse(pattern.value) : pattern.value;
      }
      
      // Return default weights
      return {
        recentMessages: 1.0,
        userHistory: 0.8,
        topicContext: 0.9,
        timeContext: 0.6,
        channelHistory: 0.7,
        personalityProfile: 1.0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting current weights:', error);
      return null;
    }
  },

  // Save context weights
  async saveWeights(weights) {
    try {
      await patternsStore.savePattern(
        'context_weights',
        'global',
        weights,
        1.0
      );
    } catch (error) {
      console.error('Error saving weights:', error);
    }
  },

  // Analyze context effectiveness
  analyzeContextEffectiveness(contexts, outcomes) {
    const analysis = {
      recentMessages: { effective: 0, ineffective: 0, total: 0 },
      userHistory: { effective: 0, ineffective: 0, total: 0 },
      topicContext: { effective: 0, ineffective: 0, total: 0 },
      timeContext: { effective: 0, ineffective: 0, total: 0 },
      channelHistory: { effective: 0, ineffective: 0, total: 0 },
      personalityProfile: { effective: 0, ineffective: 0, total: 0 }
    };
    
    contexts.forEach((context, index) => {
      const outcome = outcomes[index];
      const isEffective = outcome > 0.5;
      
      // Analyze each context component
      if (context.recentMessages && context.recentMessages.length > 0) {
        analysis.recentMessages.total++;
        if (isEffective) analysis.recentMessages.effective++;
        else analysis.recentMessages.ineffective++;
      }
      
      if (context.userHistory && context.userHistory.length > 0) {
        analysis.userHistory.total++;
        if (isEffective) analysis.userHistory.effective++;
        else analysis.userHistory.ineffective++;
      }
      
      if (context.topicContext) {
        analysis.topicContext.total++;
        if (isEffective) analysis.topicContext.effective++;
        else analysis.topicContext.ineffective++;
      }
      
      if (context.timeContext) {
        analysis.timeContext.total++;
        if (isEffective) analysis.timeContext.effective++;
        else analysis.timeContext.ineffective++;
      }
      
      if (context.channelHistory && context.channelHistory.length > 0) {
        analysis.channelHistory.total++;
        if (isEffective) analysis.channelHistory.effective++;
        else analysis.channelHistory.ineffective++;
      }
      
      if (context.personalityProfile) {
        analysis.personalityProfile.total++;
        if (isEffective) analysis.personalityProfile.effective++;
        else analysis.personalityProfile.ineffective++;
      }
    });
    
    return analysis;
  },

  // Update weights based on analysis
  updateWeights(currentWeights, analysis) {
    const updatedWeights = { ...currentWeights };
    const learningRate = 0.1; // How much to adjust weights
    
    Object.entries(analysis).forEach(([component, stats]) => {
      if (stats.total >= 5) { // Only update if we have enough data
        const effectiveness = stats.effective / stats.total;
        const currentWeight = currentWeights[component] || 0.5;
        
        // Adjust weight towards effectiveness
        const targetWeight = effectiveness;
        const newWeight = currentWeight + (targetWeight - currentWeight) * learningRate;
        
        updatedWeights[component] = Math.max(0.1, Math.min(2.0, newWeight)); // Clamp between 0.1 and 2.0
      }
    });
    
    updatedWeights.lastUpdated = new Date().toISOString();
    return updatedWeights;
  },

  // Optimize context for specific message type
  async optimizeContextForMessageType(context, messageType) {
    try {
      const weights = await this.getCurrentWeights();
      const messageTypeWeights = await this.getMessageTypeWeights(messageType);
      
      // Combine global weights with message type specific weights
      const optimizedWeights = { ...weights };
      
      Object.entries(messageTypeWeights).forEach(([component, weight]) => {
        if (optimizedWeights[component]) {
          optimizedWeights[component] = (optimizedWeights[component] + weight) / 2;
        }
      });
      
      // Apply weights to context
      return this.applyWeightsToContext(context, optimizedWeights);
    } catch (error) {
      console.error('Error optimizing context:', error);
      return context;
    }
  },

  // Get message type specific weights
  async getMessageTypeWeights(messageType) {
    try {
      const pattern = await patternsStore.getPattern('context_weights', messageType);
      if (pattern) {
        return typeof pattern.value === 'string' ? JSON.parse(pattern.value) : pattern.value;
      }
      
      // Return default weights for message type
      const defaults = {
        'eod_update': {
          recentMessages: 1.2,
          userHistory: 1.1,
          topicContext: 0.8,
          timeContext: 1.0,
          channelHistory: 0.6,
          personalityProfile: 1.0
        },
        'question': {
          recentMessages: 0.8,
          userHistory: 1.2,
          topicContext: 1.1,
          timeContext: 0.5,
          channelHistory: 0.7,
          personalityProfile: 1.0
        },
        'task_delegation': {
          recentMessages: 1.0,
          userHistory: 0.9,
          topicContext: 1.2,
          timeContext: 1.1,
          channelHistory: 0.8,
          personalityProfile: 1.0
        }
      };
      
      return defaults[messageType] || {
        recentMessages: 1.0,
        userHistory: 1.0,
        topicContext: 1.0,
        timeContext: 1.0,
        channelHistory: 1.0,
        personalityProfile: 1.0
      };
    } catch (error) {
      console.error('Error getting message type weights:', error);
      return {};
    }
  },

  // Apply weights to context
  applyWeightsToContext(context, weights) {
    const optimized = { ...context };
    
    // Adjust context based on weights
    if (context.recentMessages && weights.recentMessages) {
      const targetCount = Math.round(20 * weights.recentMessages);
      optimized.recentMessages = context.recentMessages.slice(-targetCount);
    }
    
    if (context.userHistory && weights.userHistory) {
      const targetCount = Math.round(10 * weights.userHistory);
      optimized.userHistory = context.userHistory.slice(-targetCount);
    }
    
    // For topic context, weight affects importance not quantity
    if (context.topicContext && weights.topicContext) {
      optimized.topicContextImportance = weights.topicContext;
    }
    
    // For time context, weight affects sensitivity
    if (context.timeContext && weights.timeContext) {
      optimized.timeContextSensitivity = weights.timeContext;
    }
    
    return optimized;
  },

  // Get context optimization report
  async getOptimizationReport() {
    try {
      const globalWeights = await this.getCurrentWeights();
      const messageTypes = ['eod_update', 'question', 'task_delegation'];
      
      const report = {
        global: globalWeights,
        messageTypeSpecific: {}
      };
      
      for (const type of messageTypes) {
        report.messageTypeSpecific[type] = await this.getMessageTypeWeights(type);
      }
      
      return report;
    } catch (error) {
      console.error('Error generating optimization report:', error);
      return null;
    }
  },

  // Train context optimizer with recent data
  async trainWithRecentData(days = 7) {
    try {
      console.log(`🎯 Training context optimizer with last ${days} days of data...`);
      
      // Get recent response logs with their contexts
      const recentLogs = await this.getRecentResponseLogs(days);
      
      if (recentLogs.length < 10) {
        console.log('⚠️ Not enough data to train context optimizer');
        return null;
      }
      
      // Extract contexts and outcomes
      const contexts = [];
      const outcomes = [];
      
      for (const log of recentLogs) {
        const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
        const outcome = this.calculateOutcome(log);
        
        contexts.push(context);
        outcomes.push(outcome);
      }
      
      // Learn from the data
      const updatedWeights = await this.learnContextWeights(contexts, outcomes);
      
      console.log(`✅ Trained on ${recentLogs.length} responses`);
      return updatedWeights;
    } catch (error) {
      console.error('Error training context optimizer:', error);
      return null;
    }
  },

  // Get recent response logs
  async getRecentResponseLogs(days) {
    // This would need to be implemented in messageStore
    // For now, return empty array
    return [];
  },

  // Calculate outcome from response log
  calculateOutcome(log) {
    // Simple outcome calculation based on confidence and feedback
    let outcome = (log.confidence_score || 0) / 100;
    
    // Adjust based on auto_sent (higher confidence if auto-sent)
    if (log.auto_sent) {
      outcome += 0.1;
    }
    
    return Math.max(0, Math.min(1, outcome));
  }
};
