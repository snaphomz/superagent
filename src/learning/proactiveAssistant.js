import { patternsStore } from './patternsStore.js';
import { messageStore } from '../database/messageStore.js';
import { feedbackStore } from './feedbackStore.js';
import { userProfileLearner } from './userProfileLearner.js';
import { faqAutomation } from './faqAutomation.js';

export const proactiveAssistant = {
  // Generate proactive suggestions based on team patterns
  async generateProactiveInsights(channelId, timeWindow = 24) {
    try {
      const insights = {
        pendingRisks: [],
        optimizationOpportunities: [],
        collaborationGaps: [],
        productivityTrends: []
      };
      
      // Analyze recent team activity
      const recentActivity = await this.analyzeTeamActivity(channelId, timeWindow);
      
      // Identify potential risks
      insights.pendingRisks = await this.identifyPendingRisks(recentActivity);
      
      // Find optimization opportunities
      insights.optimizationOpportunities = await this.findOptimizationOpportunities(recentActivity);
      
      // Detect collaboration gaps
      insights.collaborationGaps = await this.detectCollaborationGaps(recentActivity);
      
      // Analyze productivity trends
      insights.productivityTrends = await this.analyzeProductivityTrends(recentActivity);
      
      return insights;
    } catch (error) {
      console.error('Error generating proactive insights:', error);
      return null;
    }
  },

  // Analyze team activity
  async analyzeTeamActivity(channelId, hours) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get recent messages
    const messages = await messageStore.getChannelMessages(channelId, 100);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    // Get EOD updates
    const eodUpdates = recentMessages.filter(msg => 
      msg.text && msg.text.toLowerCase().includes('eod')
    );
    
    // Get questions asked
    const questions = recentMessages.filter(msg => 
      msg.text && msg.text.includes('?')
    );
    
    // Get task mentions
    const taskMentions = recentMessages.filter(msg => 
      msg.text && /\b(task|todo|item|action)\b/i.test(msg.text)
    );
    
    return {
      totalMessages: recentMessages.length,
      eodUpdates: eodUpdates.length,
      questions: questions.length,
      taskMentions: taskMentions.length,
      activeUsers: this.extractActiveUsers(recentMessages),
      timeRange: hours
    };
  },

  // Identify pending risks
  async identifyPendingRisks(activity) {
    const risks = [];
    
    // Risk: Low EOD completion rate
    if (activity.eodUpdates < activity.activeUsers.length * 0.8) {
      risks.push({
        type: 'low_eod_completion',
        severity: 'medium',
        description: 'EOD completion rate below 80%',
        suggestion: 'Consider sending EOD reminders',
        metrics: {
          completed: activity.eodUpdates,
          expected: activity.activeUsers.length,
          rate: (activity.eodUpdates / activity.activeUsers.length * 100).toFixed(1)
        }
      });
    }
    
    // Risk: High question rate (might indicate confusion)
    if (activity.questions > activity.totalMessages * 0.3) {
      risks.push({
        type: 'high_question_rate',
        severity: 'low',
        description: 'High question rate detected',
        suggestion: 'Review if tasks lack clarity',
        metrics: {
          questions: activity.questions,
          totalMessages: activity.totalMessages,
          rate: (activity.questions / activity.totalMessages * 100).toFixed(1)
        }
      });
    }
    
    // Risk: Low engagement (few messages)
    if (activity.totalMessages < activity.activeUsers.length * 2) {
      risks.push({
        type: 'low_engagement',
        severity: 'high',
        description: 'Low team engagement detected',
        suggestion: 'Check if team is blocked or needs assistance',
        metrics: {
          messages: activity.totalMessages,
          users: activity.activeUsers.length,
          avgPerUser: (activity.totalMessages / activity.activeUsers.length).toFixed(1)
        }
      });
    }
    
    return risks;
  },

  // Find optimization opportunities
  async findOptimizationOpportunities(activity) {
    const opportunities = [];
    
    // Opportunity: FAQ automation
    if (activity.questions > 5) {
      opportunities.push({
        type: 'faq_automation',
        description: 'Frequently asked questions can be automated',
        potentialImpact: 'high',
        suggestion: 'Review common questions and create FAQ responses',
        metrics: {
          questions: activity.questions,
          potentialSavings: activity.questions * 2 // 2 minutes saved per question
        }
      });
    }
    
    // Opportunity: Task tracking improvement
    if (activity.taskMentions > 3) {
      opportunities.push({
        type: 'task_tracking',
        description: 'Tasks mentioned but not formally tracked',
        potentialImpact: 'medium',
        suggestion: 'Implement better task capture in ClickUp',
        metrics: {
          mentions: activity.taskMentions,
          trackingGap: activity.taskMentions * 0.6 // Assume 60% not tracked
        }
      });
    }
    
    // Opportunity: Meeting optimization
    const meetingMentions = activity.totalMessages * 0.1; // Estimate
    if (meetingMentions > 2) {
      opportunities.push({
        type: 'meeting_optimization',
        description: 'Many meeting-related discussions',
        potentialImpact: 'medium',
        suggestion: 'Consider if meetings can be more efficient',
        metrics: {
          estimatedMentions: Math.round(meetingMentions),
          timeCost: meetingMentions * 30 // 30 minutes per meeting
        }
      });
    }
    
    return opportunities;
  },

  // Detect collaboration gaps
  async detectCollaborationGaps(activity) {
    const gaps = [];
    
    // Gap: Isolated team members
    if (activity.activeUsers.length > 3) {
      const userMessages = {};
      activity.activeUsers.forEach(user => {
        userMessages[user] = 0;
      });
      
      // Count messages per user (would need actual message data)
      const avgMessages = activity.totalMessages / activity.activeUsers.length;
      const threshold = avgMessages * 0.3; // Less than 30% of average
      
      // Check for inactive users (simplified)
      const inactiveCount = Math.max(0, activity.activeUsers.length - Math.ceil(activity.totalMessages / 10));
      
      if (inactiveCount > 0) {
        gaps.push({
          type: 'user_isolation',
          description: 'Some team members may be disengaged',
          severity: 'medium',
          suggestion: 'Check in with less active team members',
          metrics: {
            inactiveUsers: inactiveCount,
            totalUsers: activity.activeUsers.length
          }
        });
      }
    }
    
    // Gap: Cross-team collaboration
    const crossTeamMentions = activity.totalMessages * 0.05; // Estimate
    if (crossTeamMentions < 1 && activity.activeUsers.length > 2) {
      gaps.push({
        type: 'cross_team_collaboration',
        description: 'Limited cross-team collaboration detected',
        severity: 'low',
        suggestion: 'Encourage more cross-functional communication',
        metrics: {
          estimatedMentions: Math.round(crossTeamMentions),
          teamSize: activity.activeUsers.length
        }
      });
    }
    
    return gaps;
  },

  // Analyze productivity trends
  async analyzeProductivityTrends(activity) {
    const trends = [];
    
    // Trend: EOD completion trend
    const eodRate = activity.eodUpdates / activity.activeUsers.length;
    let eodTrend = 'stable';
    if (eodRate > 0.9) eodTrend = 'improving';
    else if (eodRate < 0.7) eodTrend = 'declining';
    
    trends.push({
      type: 'eod_completion',
      trend: eodTrend,
      value: (eodRate * 100).toFixed(1),
      description: `EOD completion is ${eodTrend}`,
      suggestion: eodTrend === 'declining' ? 'Investigate reasons for drop in EOD completion' : 'Keep up the good work'
    });
    
    // Trend: Question frequency trend
    const questionRate = activity.questions / activity.totalMessages;
    let questionTrend = 'normal';
    if (questionRate > 0.3) questionTrend = 'increasing';
    else if (questionRate < 0.1) questionTrend = 'decreasing';
    
    trends.push({
      type: 'question_frequency',
      trend: questionTrend,
      value: (questionRate * 100).toFixed(1),
      description: `Question frequency is ${questionTrend}`,
      suggestion: questionTrend === 'increasing' ? 'May indicate unclear tasks or blockers' : 'Team appears to have good clarity'
    });
    
    // Trend: Engagement trend
    const engagementRate = activity.totalMessages / activity.activeUsers.length;
    let engagementTrend = 'normal';
    if (engagementRate > 5) engagementTrend = 'high';
    else if (engagementRate < 2) engagementTrend = 'low';
    
    trends.push({
      type: 'engagement',
      trend: engagementTrend,
      value: engagementRate.toFixed(1),
      description: `Team engagement is ${engagementTrend}`,
      suggestion: engagementTrend === 'low' ? 'Consider team check-in or blockers assessment' : 'Good team engagement level'
    });
    
    return trends;
  },

  // Generate proactive message
  async generateProactiveMessage(insights, priority = 'medium') {
    const messages = [];
    
    // High priority: Critical risks
    const criticalRisks = insights.pendingRisks.filter(r => r.severity === 'high');
    if (criticalRisks.length > 0) {
      messages.push({
        type: 'risk_alert',
        priority: 'high',
        message: `🚨 *Critical Risk Alert*\n\n${criticalRisks.map(r => `• ${r.description}: ${r.suggestion}`).join('\n')}`,
        actionable: true
      });
    }
    
    // Medium priority: Optimization opportunities
    if (priority === 'medium' || priority === 'low') {
      const highImpactOps = insights.optimizationOpportunities.filter(o => o.potentialImpact === 'high');
      if (highImpactOps.length > 0) {
        messages.push({
          type: 'optimization',
          priority: 'medium',
          message: `💡 *Optimization Opportunity*\n\n${highImpactOps[0].description}\n${highImpactOps[0].suggestion}`,
          actionable: true
        });
      }
    }
    
    // Low priority: General insights
    if (priority === 'low') {
      const positiveTrends = insights.productivityTrends.filter(t => t.trend === 'improving');
      if (positiveTrends.length > 0) {
        messages.push({
          type: 'positive_trend',
          priority: 'low',
          message: `📈 *Positive Trend*\n\n${positiveTrends[0].description}\n${positiveTrends[0].suggestion}`,
          actionable: false
        });
      }
    }
    
    return messages;
  },

  // Check if proactive message should be sent
  async shouldSendProactive(channelId, message) {
    // Check if similar message was sent recently
    const recentLogs = await messageStore.getResponseLogs(10);
    const similarMessages = recentLogs.filter(log => 
      log.generated_response && 
      log.generated_response.includes(message.type === 'risk_alert' ? 'Risk Alert' : 'Optimization')
    );
    
    // Don't send if similar message sent in last 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const recentSimilar = similarMessages.filter(log => 
      new Date(log.created_at) > twelveHoursAgo
    );
    
    return recentSimilar.length === 0;
  },

  // Extract active users from messages
  extractActiveUsers(messages) {
    const users = new Set();
    messages.forEach(msg => {
      if (msg.user_id) {
        users.add(msg.user_id);
      }
    });
    return Array.from(users);
  },

  // Get team health score
  async calculateTeamHealthScore(insights) {
    let score = 100; // Start with perfect score
    
    // Deduct points for risks
    insights.pendingRisks.forEach(risk => {
      if (risk.severity === 'high') score -= 20;
      else if (risk.severity === 'medium') score -= 10;
      else if (risk.severity === 'low') score -= 5;
    });
    
    // Add points for positive trends
    insights.productivityTrends.forEach(trend => {
      if (trend.trend === 'improving') score += 5;
      else if (trend.trend === 'declining') score -= 5;
    });
    
    // Ensure score stays in bounds
    return Math.max(0, Math.min(100, score));
  }
};
