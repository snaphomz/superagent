import { patternsStore } from './patternsStore.js';
import { messageStore } from '../database/messageStore.js';
import { userProfileLearner } from './userProfileLearner.js';
import { feedbackStore } from './feedbackStore.js';

export const teamInsightsGenerator = {
  // Generate comprehensive team insights
  async generateTeamInsights(channelId, period = 'week') {
    try {
      const insights = {
        overview: await this.generateOverview(channelId, period),
        communicationPatterns: await this.analyzeCommunicationPatterns(channelId, period),
        collaborationMetrics: await this.calculateCollaborationMetrics(channelId, period),
        productivityAnalysis: await this.analyzeProductivity(channelId, period),
        individualContributions: await this.analyzeIndividualContributions(channelId, period),
        recommendations: []
      };
      
      // Generate recommendations based on insights
      insights.recommendations = await this.generateRecommendations(insights);
      
      return insights;
    } catch (error) {
      console.error('Error generating team insights:', error);
      return null;
    }
  },

  // Generate overview
  async generateOverview(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const messages = await messageStore.getChannelMessages(channelId, 500);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    const activeUsers = this.extractActiveUsers(recentMessages);
    const eodUpdates = recentMessages.filter(msg => 
      msg.text && msg.text.toLowerCase().includes('eod')
    );
    const questions = recentMessages.filter(msg => 
      msg.text && msg.text.includes('?')
    );
    
    return {
      period,
      totalMessages: recentMessages.length,
      activeUsers: activeUsers.length,
      eodCompletionRate: (eodUpdates.length / Math.max(activeUsers.length, 1) * 100).toFixed(1),
      questionRate: (questions.length / Math.max(recentMessages.length, 1) * 100).toFixed(1),
      avgMessagesPerUser: (recentMessages.length / Math.max(activeUsers.length, 1)).toFixed(1),
      mostActiveDay: await this.findMostActiveDay(recentMessages)
    };
  },

  // Analyze communication patterns
  async analyzeCommunicationPatterns(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const messages = await messageStore.getChannelMessages(channelId, 500);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    const patterns = {
      peakHours: this.findPeakHours(recentMessages),
      responseTimes: await this.calculateResponseTimes(recentMessages),
      messageTypes: this.categorizeMessages(recentMessages),
      sentiment: await this.analyzeSentiment(recentMessages),
      threadDepth: this.analyzeThreadDepth(recentMessages)
    };
    
    return patterns;
  },

  // Calculate collaboration metrics
  async calculateCollaborationMetrics(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const messages = await messageStore.getChannelMessages(channelId, 500);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    const metrics = {
      crossReferences: this.countCrossReferences(recentMessages),
      threadParticipation: this.calculateThreadParticipation(recentMessages),
      helpSeeking: this.countHelpSeeking(recentMessages),
      knowledgeSharing: this.countKnowledgeSharing(recentMessages),
      networkDensity: this.calculateNetworkDensity(recentMessages)
    };
    
    return metrics;
  },

  // Analyze productivity
  async analyzeProductivity(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const messages = await messageStore.getChannelMessages(channelId, 500);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    const productivity = {
      taskCompletion: await this.analyzeTaskCompletion(recentMessages),
      blockerIdentification: this.countBlockerMentions(recentMessages),
      decisionMaking: this.countDecisionMaking(recentMessages),
      initiativeTaking: this.countInitiatives(recentMessages),
      timeManagement: this.analyzeTimeManagement(recentMessages)
    };
    
    return productivity;
  },

  // Analyze individual contributions
  async analyzeIndividualContributions(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const messages = await messageStore.getChannelMessages(channelId, 500);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    const userStats = {};
    
    // Group messages by user
    recentMessages.forEach(msg => {
      if (!msg.user_id) return;
      
      if (!userStats[msg.user_id]) {
        userStats[msg.user_id] = {
          messageCount: 0,
          questions: 0,
          eodUpdates: 0,
          helpProvided: 0,
          initiatives: 0,
          threadStarts: 0
        };
      }
      
      const stats = userStats[msg.user_id];
      stats.messageCount++;
      
      if (msg.text && msg.text.includes('?')) stats.questions++;
      if (msg.text && msg.text.toLowerCase().includes('eod')) stats.eodUpdates++;
      if (msg.text && /\b(how to|try this|here's|can help)\b/i.test(msg.text)) stats.helpProvided++;
      if (msg.text && /\b(i will|i can|let me|i'll)\b/i.test(msg.text)) stats.initiatives++;
      if (!msg.thread_ts && msg.thread_ts !== msg.ts) stats.threadStarts++;
    });
    
    // Calculate scores for each user
    Object.keys(userStats).forEach(userId => {
      const stats = userStats[userId];
      stats.contributionScore = this.calculateContributionScore(stats);
      stats.engagementLevel = this.calculateEngagementLevel(stats);
    });
    
    return userStats;
  },

  // Generate recommendations
  async generateRecommendations(insights) {
    const recommendations = [];
    
    // Communication recommendations
    if (insights.communicationPatterns.responseTimes.avg > 60) {
      recommendations.push({
        category: 'communication',
        priority: 'medium',
        title: 'Improve Response Times',
        description: 'Average response time is over 1 hour. Consider setting expectations for quicker responses.',
        impact: 'Improved team agility'
      });
    }
    
    // Collaboration recommendations
    if (insights.collaborationMetrics.crossReferences < 10) {
      recommendations.push({
        category: 'collaboration',
        priority: 'low',
        title: 'Increase Cross-Referencing',
        description: 'Low cross-referencing detected. Encourage team members to reference each other\'s work.',
        impact: 'Better knowledge sharing'
      });
    }
    
    // Productivity recommendations
    if (insights.productivityAnalysis.blockerIdentification > 5) {
      recommendations.push({
        category: 'productivity',
        priority: 'high',
        title: 'Address Blockers Proactively',
        description: 'Multiple blockers identified. Consider daily blocker check-ins.',
        impact: 'Reduced delays'
      });
    }
    
    // Individual recommendations
    const lowContributors = Object.entries(insights.individualContributions)
      .filter(([_, stats]) => stats.contributionScore < 30);
    
    if (lowContributors.length > 0) {
      recommendations.push({
        category: 'individual',
        priority: 'medium',
        title: 'Support Less Active Members',
        description: `${lowContributors.length} team members show low engagement. Consider checking in on them.`,
        impact: 'Improved team participation'
      });
    }
    
    return recommendations;
  },

  // Helper methods
  extractActiveUsers(messages) {
    const users = new Set();
    messages.forEach(msg => {
      if (msg.user_id) users.add(msg.user_id);
    });
    return Array.from(users);
  },

  async findMostActiveDay(messages) {
    const dayCounts = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    
    messages.forEach(msg => {
      const day = new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
      if (dayCounts[day] !== undefined) {
        dayCounts[day]++;
      }
    });
    
    let maxDay = 'Monday';
    let maxCount = 0;
    
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxDay = day;
      }
    });
    
    return { day: maxDay, count: maxCount };
  },

  findPeakHours(messages) {
    const hourCounts = {};
    
    messages.forEach(msg => {
      const hour = new Date(msg.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    // Find top 3 peak hours
    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));
    
    return sortedHours;
  },

  async calculateResponseTimes(messages) {
    // Simplified response time calculation
    const responseTimes = [];
    
    // Group messages by thread
    const threads = {};
    messages.forEach(msg => {
      const threadId = msg.thread_ts || msg.ts;
      if (!threads[threadId]) threads[threadId] = [];
      threads[threadId].push(msg);
    });
    
    // Calculate response times within threads
    Object.values(threads).forEach(threadMessages => {
      if (threadMessages.length > 1) {
        threadMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        for (let i = 1; i < threadMessages.length; i++) {
          const timeDiff = new Date(threadMessages[i].timestamp) - new Date(threadMessages[i-1].timestamp);
          responseTimes.push(timeDiff / (1000 * 60)); // Convert to minutes
        }
      }
    });
    
    if (responseTimes.length === 0) {
      return { avg: 0, median: 0, min: 0, max: 0 };
    }
    
    responseTimes.sort((a, b) => a - b);
    
    return {
      avg: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
      median: responseTimes[Math.floor(responseTimes.length / 2)],
      min: responseTimes[0],
      max: responseTimes[responseTimes.length - 1]
    };
  },

  categorizeMessages(messages) {
    const types = {
      questions: 0,
      announcements: 0,
      updates: 0,
      discussions: 0,
      tasks: 0
    };
    
    messages.forEach(msg => {
      if (!msg.text) return;
      
      const text = msg.text.toLowerCase();
      if (text.includes('?')) types.questions++;
      else if (/\b(announcement|announcing)\b/i.test(text)) types.announcements++;
      else if (/\b(update|status|progress)\b/i.test(text)) types.updates++;
      else if (/\b(task|todo|item|action)\b/i.test(text)) types.tasks++;
      else types.discussions++;
    });
    
    return types;
  },

  async analyzeSentiment(messages) {
    // Simplified sentiment analysis
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    
    messages.forEach(msg => {
      if (!msg.text) return;
      
      const text = msg.text.toLowerCase();
      const positiveWords = ['good', 'great', 'awesome', 'excellent', 'perfect', 'done', 'completed', 'success'];
      const negativeWords = ['problem', 'issue', 'blocked', 'stuck', 'delay', 'error', 'fail', 'bug'];
      
      const hasPositive = positiveWords.some(word => text.includes(word));
      const hasNegative = negativeWords.some(word => text.includes(word));
      
      if (hasPositive && !hasNegative) positive++;
      else if (hasNegative && !hasPositive) negative++;
      else neutral++;
    });
    
    const total = positive + negative + neutral;
    
    return {
      positive: (positive / total * 100).toFixed(1),
      negative: (negative / total * 100).toFixed(1),
      neutral: (neutral / total * 100).toFixed(1)
    };
  },

  analyzeThreadDepth(messages) {
    const threadDepths = {};
    
    messages.forEach(msg => {
      const threadId = msg.thread_ts || msg.ts;
      threadDepths[threadId] = (threadDepths[threadId] || 0) + 1;
    });
    
    const depths = Object.values(threadDepths);
    const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;
    const maxDepth = Math.max(...depths);
    
    return { avg: avgDepth.toFixed(1), max: maxDepth };
  },

  countCrossReferences(messages) {
    let count = 0;
    messages.forEach(msg => {
      if (msg.text && /<@[A-Z0-9]+>/.test(msg.text)) {
        const mentions = msg.text.match(/<@[A-Z0-9]+>/g) || [];
        count += mentions.length;
      }
    });
    return count;
  },

  calculateThreadParticipation(messages) {
    const threadUsers = {};
    
    messages.forEach(msg => {
      const threadId = msg.thread_ts || msg.ts;
      if (!threadUsers[threadId]) threadUsers[threadId] = new Set();
      if (msg.user_id) threadUsers[threadId].add(msg.user_id);
    });
    
    const participations = Object.values(threadUsers).map(users => users.size);
    const avgParticipation = participations.reduce((sum, p) => sum + p, 0) / participations.length;
    
    return { avg: avgParticipation.toFixed(1), max: Math.max(...participations) };
  },

  countHelpSeeking(messages) {
    return messages.filter(msg => 
      msg.text && /\b(help|stuck|blocked|issue|problem|can't)\b/i.test(msg.text)
    ).length;
  },

  countKnowledgeSharing(messages) {
    return messages.filter(msg => 
      msg.text && /\b(here's|try this|how to|solution|fix)\b/i.test(msg.text)
    ).length;
  },

  calculateNetworkDensity(messages) {
    const users = this.extractActiveUsers(messages);
    const connections = new Set();
    
    messages.forEach(msg => {
      if (msg.text && msg.user_id) {
        const mentions = msg.text.match(/<@[A-Z0-9]+>/g) || [];
        mentions.forEach(mention => {
          const mentionedUser = mention.slice(2, -1);
          if (mentionedUser !== msg.user_id) {
            connections.add(`${msg.user_id}-${mentionedUser}`);
          }
        });
      }
    });
    
    const maxConnections = users.length * (users.length - 1) / 2;
    const density = maxConnections > 0 ? (connections.size / maxConnections * 100).toFixed(1) : 0;
    
    return { density, connections: connections.size, maxConnections };
  },

  async analyzeTaskCompletion(messages) {
    const completedKeywords = ['done', 'completed', 'finished', 'resolved', 'closed'];
    const taskKeywords = ['task', 'item', 'action', 'todo'];
    
    let completed = 0;
    let total = 0;
    
    messages.forEach(msg => {
      if (msg.text) {
        const text = msg.text.toLowerCase();
        if (taskKeywords.some(keyword => text.includes(keyword))) {
          total++;
          if (completedKeywords.some(keyword => text.includes(keyword))) {
            completed++;
          }
        }
      }
    });
    
    return {
      completed,
      total,
      rate: total > 0 ? (completed / total * 100).toFixed(1) : 0
    };
  },

  countBlockerMentions(messages) {
    return messages.filter(msg => 
      msg.text && /\b(blocked|blocker|stuck|waiting|depend)\b/i.test(msg.text)
    ).length;
  },

  countDecisionMaking(messages) {
    return messages.filter(msg => 
      msg.text && /\b(decided|decision|choose|selected|approved)\b/i.test(msg.text)
    ).length;
  },

  countInitiatives(messages) {
    return messages.filter(msg => 
      msg.text && /\b(i will|i can|let me|i'll|going to)\b/i.test(msg.text)
    ).length;
  },

  analyzeTimeManagement(messages) {
    const timeKeywords = ['today', 'tomorrow', 'deadline', 'by', 'end of', 'asap'];
    let timeReferences = 0;
    
    messages.forEach(msg => {
      if (msg.text && timeKeywords.some(keyword => msg.text.toLowerCase().includes(keyword))) {
        timeReferences++;
      }
    });
    
    return {
      timeReferences,
      rate: messages.length > 0 ? (timeReferences / messages.length * 100).toFixed(1) : 0
    };
  },

  calculateContributionScore(stats) {
    let score = 0;
    
    // Base score from message count
    score += Math.min(stats.messageCount * 2, 40);
    
    // Bonus for EOD updates
    score += stats.eodUpdates * 5;
    
    // Bonus for helping others
    score += stats.helpProvided * 3;
    
    // Bonus for taking initiatives
    score += stats.initiatives * 2;
    
    // Small bonus for starting threads
    score += stats.threadStarts;
    
    return Math.min(100, score);
  },

  calculateEngagementLevel(stats) {
    if (stats.contributionScore >= 70) return 'high';
    if (stats.contributionScore >= 40) return 'medium';
    return 'low';
  }
};
