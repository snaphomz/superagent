import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';

export const userProfileLearner = {
  // Learn user-specific communication preferences
  async learnUserPreferences(userId, responses, feedback) {
    try {
      const profile = await this.getUserProfile(userId);
      
      // Analyze response patterns for this user
      const stylePreferences = this.analyzeStylePreferences(responses, feedback);
      const topicPreferences = this.analyzeTopicPreferences(responses, feedback);
      const timingPreferences = this.analyzeTimingPreferences(responses, feedback);
      
      // Update user profile
      const updatedProfile = {
        ...profile,
        userId,
        stylePreferences,
        topicPreferences,
        timingPreferences,
        lastUpdated: new Date().toISOString()
      };
      
      await this.saveUserProfile(updatedProfile);
      
      console.log(`👤 Updated user profile for ${userId}:`);
      console.log(`  - Style preferences: ${Object.keys(stylePreferences).length} patterns`);
      console.log(`  - Topic preferences: ${Object.keys(topicPreferences).length} topics`);
      console.log(`  - Timing preferences: ${Object.keys(timingPreferences).length} patterns`);
      
      return updatedProfile;
    } catch (error) {
      console.error('Error learning user preferences:', error);
      return null;
    }
  },

  // Get user profile
  async getUserProfile(userId) {
    try {
      const pattern = await patternsStore.getPattern('user_profile', userId);
      if (pattern) {
        return typeof pattern.value === 'string' ? JSON.parse(pattern.value) : pattern.value;
      }
      
      // Return default profile
      return {
        userId,
        stylePreferences: {},
        topicPreferences: {},
        timingPreferences: {},
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  },

  // Save user profile
  async saveUserProfile(profile) {
    try {
      await patternsStore.savePattern(
        'user_profile',
        profile.userId,
        profile,
        1.0 // High success rate for user profiles
      );
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  },

  // Analyze style preferences from responses
  analyzeStylePreferences(responses, feedback) {
    const preferences = {};
    
    // Analyze response length preference
    const lengths = responses.map(r => r.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const lengthSuccess = this.calculateSuccessRate(responses, feedback, r => r.length);
    
    preferences.preferredLength = {
      average: avgLength,
      effective: lengthSuccess.best || avgLength,
      range: [Math.min(...lengths), Math.max(...lengths)]
    };
    
    // Analyze formality preference
    const formalityScores = responses.map(r => this.calculateFormality(r));
    const formalitySuccess = this.calculateSuccessRate(responses, feedback, r => this.calculateFormality(r));
    
    preferences.formality = {
      average: formalityScores.reduce((a, b) => a + b, 0) / formalityScores.length,
      effective: formalitySuccess.best || 0.5,
      prefersFormal: formalitySuccess.best > 0.6
    };
    
    // Analyze directness preference
    const directnessScores = responses.map(r => this.calculateDirectness(r));
    const directnessSuccess = this.calculateSuccessRate(responses, feedback, r => this.calculateDirectness(r));
    
    preferences.directness = {
      average: directnessScores.reduce((a, b) => a + b, 0) / directnessScores.length,
      effective: directnessSuccess.best || 0.7,
      prefersDirect: directnessSuccess.best > 0.6
    };
    
    return preferences;
  },

  // Analyze topic preferences
  analyzeTopicPreferences(responses, feedback) {
    const preferences = {};
    
    // Extract topics from responses
    const topics = {};
    responses.forEach(response => {
      const responseTopics = this.extractTopics(response);
      responseTopics.forEach(topic => {
        if (!topics[topic]) topics[topic] = [];
        topics[topic].push(response);
      });
    });
    
    // Calculate success rate for each topic
    Object.entries(topics).forEach(([topic, topicResponses]) => {
      const successRate = this.calculateSuccessRateForResponses(topicResponses, feedback);
      preferences[topic] = {
        responseCount: topicResponses.length,
        successRate: successRate,
        preferred: successRate > 0.7
      };
    });
    
    return preferences;
  },

  // Analyze timing preferences
  analyzeTimingPreferences(responses, feedback) {
    const preferences = {};
    
    // Group responses by time of day
    const timeGroups = {
      morning: [],    // 6-12
      afternoon: [],  // 12-18
      evening: [],    // 18-24
      night: []       // 0-6
    };
    
    responses.forEach(response => {
      const hour = new Date(response.timestamp || Date.now()).getHours();
      if (hour >= 6 && hour < 12) timeGroups.morning.push(response);
      else if (hour >= 12 && hour < 18) timeGroups.afternoon.push(response);
      else if (hour >= 18 && hour < 24) timeGroups.evening.push(response);
      else timeGroups.night.push(response);
    });
    
    // Calculate success rates for each time period
    Object.entries(timeGroups).forEach(([period, periodResponses]) => {
      if (periodResponses.length > 0) {
        const successRate = this.calculateSuccessRateForResponses(periodResponses, feedback);
        preferences[period] = {
          responseCount: periodResponses.length,
          successRate: successRate,
          preferred: successRate > 0.7
        };
      }
    });
    
    return preferences;
  },

  // Get personalized response suggestions
  async getPersonalizedSuggestions(userId, messageType, context) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) return [];
      
      const suggestions = [];
      
      // Style suggestions
      if (profile.stylePreferences) {
        if (profile.stylePreferences.preferredLength) {
          const targetLength = profile.stylePreferences.preferredLength.effective;
          suggestions.push({
            type: 'length',
            value: targetLength,
            reason: `User prefers ${targetLength.toFixed(0)} character responses`
          });
        }
        
        if (profile.stylePreferences.formality) {
          const formality = profile.stylePreferences.formality.prefersFormal ? 'formal' : 'casual';
          suggestions.push({
            type: 'formality',
            value: formality,
            reason: `User prefers ${formality} communication style`
          });
        }
        
        if (profile.stylePreferences.directness) {
          const directness = profile.stylePreferences.directness.prefersDirect ? 'direct' : 'diplomatic';
          suggestions.push({
            type: 'directness',
            value: directness,
            reason: `User prefers ${directness} communication`
          });
        }
      }
      
      // Topic suggestions
      if (profile.topicPreferences) {
        const preferredTopics = Object.entries(profile.topicPreferences)
          .filter(([_, pref]) => pref.preferred)
          .map(([topic, _]) => topic);
        
        if (preferredTopics.length > 0) {
          suggestions.push({
            type: 'topics',
            value: preferredTopics,
            reason: `User engages well with: ${preferredTopics.join(', ')}`
          });
        }
      }
      
      return suggestions;
    } catch (error) {
      console.error('Error getting personalized suggestions:', error);
      return [];
    }
  },

  // Helper methods
  calculateFormality(response) {
    const text = response.toLowerCase();
    let formality = 0.5; // baseline
    
    // Formal indicators
    if (/\b(please|thank you|would you could|appreciate)\b/i.test(response)) formality += 0.2;
    if (/\b(dear|regards|sincerely)\b/i.test(response)) formality += 0.2;
    if (!text.includes('!')) formality += 0.1;
    
    // Informal indicators
    if (/\b(hey|yo|what's up|gonna|wanna)\b/i.test(response)) formality -= 0.2;
    if (text.includes('!')) formality -= 0.1;
    if (/\b(lol|haha)\b/i.test(response)) formality -= 0.2;
    
    return Math.max(0, Math.min(1, formality));
  },

  calculateDirectness(response) {
    const text = response.toLowerCase();
    let directness = 0.5; // baseline
    
    // Direct indicators
    if (/\b(yes|no|will|can|do|did|confirm|acknowledge)\b/i.test(response)) directness += 0.3;
    if (!/\b(maybe|possibly|probably|might|could be)\b/i.test(response)) directness += 0.2;
    if (response.split(/[.!?]/).filter(s => s.trim()).length <= 2) directness += 0.1;
    
    // Indirect indicators
    if (/\b(perhaps we could consider|maybe we should|it might be helpful)\b/i.test(response)) directness -= 0.3;
    if (response.length > 200) directness -= 0.1;
    
    return Math.max(0, Math.min(1, directness));
  },

  extractTopics(response) {
    const topics = [];
    const text = response.toLowerCase();
    
    // Common work topics
    const topicKeywords = {
      'development': ['code', 'develop', 'programming', 'feature', 'bug', 'fix'],
      'design': ['design', 'ui', 'ux', 'mockup', 'prototype'],
      'testing': ['test', 'testing', 'qa', 'quality'],
      'deployment': ['deploy', 'release', 'production', 'live'],
      'planning': ['plan', 'planning', 'schedule', 'timeline'],
      'meetings': ['meeting', 'call', 'discussion', 'standup'],
      'documentation': ['docs', 'documentation', 'readme', 'wiki']
    };
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        topics.push(topic);
      }
    });
    
    return topics;
  },

  calculateSuccessRate(responses, feedback, extractor) {
    const scores = responses.map((r, i) => {
      const value = extractor(r);
      const feedbackForResponse = feedback.filter(f => f.responseIndex === i);
      const avgImpact = feedbackForResponse.reduce((sum, f) => sum + (f.confidence_impact || 0), 0) / feedbackForResponse.length || 0;
      return { value, impact: avgImpact };
    });
    
    // Find value range with highest success
    const ranges = [
      { min: 0, max: 50, scores: scores.filter(s => s.value <= 50) },
      { min: 50, max: 100, scores: scores.filter(s => s.value > 50 && s.value <= 100) },
      { min: 100, max: 200, scores: scores.filter(s => s.value > 100 && s.value <= 200) },
      { min: 200, max: Infinity, scores: scores.filter(s => s.value > 200) }
    ];
    
    let bestRange = null;
    let bestScore = -1;
    
    ranges.forEach(range => {
      if (range.scores.length > 0) {
        const avgImpact = range.scores.reduce((sum, s) => sum + s.impact, 0) / range.scores.length;
        if (avgImpact > bestScore) {
          bestScore = avgImpact;
          bestRange = range;
        }
      }
    });
    
    return {
      best: bestRange ? (bestRange.min + bestRange.max) / 2 : null,
      ranges: ranges.map(r => ({
        range: `${r.min}-${r.max === Infinity ? '∞' : r.max}`,
        success: r.scores.length > 0 ? r.scores.reduce((sum, s) => sum + s.impact, 0) / r.scores.length : 0,
        count: r.scores.length
      }))
    };
  },

  calculateSuccessRateForResponses(responses, feedback) {
    if (responses.length === 0) return 0;
    
    let totalImpact = 0;
    let feedbackCount = 0;
    
    responses.forEach((response, index) => {
      const responseFeedback = feedback.filter(f => f.responseIndex === index);
      if (responseFeedback.length > 0) {
        totalImpact += responseFeedback.reduce((sum, f) => sum + (f.confidence_impact || 0), 0);
        feedbackCount += responseFeedback.length;
      }
    });
    
    return feedbackCount > 0 ? (totalImpact / feedbackCount + 1) / 2 : 0.5;
  }
};
