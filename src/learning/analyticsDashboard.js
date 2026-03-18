import { teamInsightsGenerator } from './teamInsightsGenerator.js';
import { proactiveAssistant } from './proactiveAssistant.js';
import { faqAutomation } from './faqAutomation.js';
import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { messageStore } from '../database/messageStore.js';

export const analyticsDashboard = {
  // Generate comprehensive dashboard data
  async generateDashboardData(channelId, period = 'week') {
    try {
      const dashboard = {
        overview: await this.generateOverviewMetrics(channelId, period),
        learningMetrics: await this.generateLearningMetrics(),
        teamInsights: await teamInsightsGenerator.generateTeamInsights(channelId, period),
        proactiveInsights: await proactiveAssistant.generateProactiveInsights(channelId, 24),
        trends: await this.generateTrends(channelId, period),
        recommendations: [],
        healthScore: 0
      };
      
      // Calculate overall health score
      dashboard.healthScore = await this.calculateOverallHealth(dashboard);
      
      // Generate executive recommendations
      dashboard.recommendations = await this.generateExecutiveRecommendations(dashboard);
      
      return dashboard;
    } catch (error) {
      console.error('Error generating dashboard data:', error);
      return null;
    }
  },

  // Generate overview metrics
  async generateOverviewMetrics(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const messages = await messageStore.getChannelMessages(channelId, 500);
    const recentMessages = messages.filter(msg => 
      new Date(msg.timestamp) > cutoff && msg.is_user_message
    );
    
    const responseLogs = await messageStore.getResponseLogs(100);
    const recentResponses = responseLogs.filter(log => 
      new Date(log.created_at) > cutoff
    );
    
    return {
      totalMessages: recentMessages.length,
      botResponses: recentResponses.length,
      avgConfidence: recentResponses.length > 0 
        ? (recentResponses.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / recentResponses.length).toFixed(1)
        : 0,
      autoSentRate: recentResponses.length > 0
        ? (recentResponses.filter(r => r.auto_sent).length / recentResponses.length * 100).toFixed(1)
        : 0,
      activeUsers: this.extractActiveUsers(recentMessages).length,
      period
    };
  },

  // Generate learning metrics
  async generateLearningMetrics() {
    const patterns = await patternsStore.getTopPatterns('style_pattern', 50);
    const feedback = await feedbackStore.getFeedbackPatterns(100);
    const faqStats = await faqAutomation.getFAQStats();
    
    return {
      totalPatterns: patterns.length,
      avgSuccessRate: patterns.length > 0
        ? (patterns.reduce((sum, p) => sum + p.success_rate, 0) / patterns.length * 100).toFixed(1)
        : 0,
      totalFeedback: feedback.reduce((sum, f) => sum + f.frequency, 0),
      avgFeedbackImpact: feedback.length > 0
        ? (feedback.reduce((sum, f) => sum + (f.avg_impact || 0), 0) / feedback.length).toFixed(2)
        : 0,
      faqPatterns: faqStats?.totalPatterns || 0,
      faqSuccessRate: faqStats?.averageSuccessRate ? (faqStats.averageSuccessRate * 100).toFixed(1) : 0
    };
  },

  // Generate trends
  async generateTrends(channelId, period) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const trends = [];
    
    // Generate daily trends
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayMessages = await messageStore.getChannelMessages(channelId, 100);
      const dayData = dayMessages.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= dayStart && msgDate <= dayEnd && msg.is_user_message;
      });
      
      const dayResponses = await messageStore.getResponseLogs(50);
      const dayResponseData = dayResponses.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= dayStart && logDate <= dayEnd;
      });
      
      trends.push({
        date: dayStart.toISOString().split('T')[0],
        messages: dayData.length,
        responses: dayResponseData.length,
        avgConfidence: dayResponseData.length > 0
          ? (dayResponseData.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / dayResponseData.length).toFixed(1)
          : 0,
        activeUsers: this.extractActiveUsers(dayData).length
      });
    }
    
    return trends;
  },

  // Calculate overall health score
  async calculateOverallHealth(dashboard) {
    let score = 0;
    let factors = 0;
    
    // Team engagement factor (30%)
    if (dashboard.overview.activeUsers > 0) {
      const engagementScore = Math.min(100, (dashboard.overview.totalMessages / dashboard.overview.activeUsers) * 10);
      score += engagementScore * 0.3;
      factors += 0.3;
    }
    
    // Bot performance factor (25%)
    if (dashboard.overview.botResponses > 0) {
      const botScore = (parseFloat(dashboard.overview.avgConfidence) + parseFloat(dashboard.overview.autoSentRate)) / 2;
      score += botScore * 0.25;
      factors += 0.25;
    }
    
    // Learning effectiveness factor (25%)
    if (dashboard.learningMetrics.totalPatterns > 0) {
      const learningScore = parseFloat(dashboard.learningMetrics.avgSuccessRate);
      score += learningScore * 0.25;
      factors += 0.25;
    }
    
    // Team insights factor (20%)
    if (dashboard.teamInsights) {
      const eodRate = parseFloat(dashboard.teamInsights.overview.eodCompletionRate);
      const insightsScore = Math.min(100, eodRate * 1.2); // Scale EOD rate slightly
      score += insightsScore * 0.2;
      factors += 0.2;
    }
    
    return factors > 0 ? (score / factors).toFixed(1) : 0;
  },

  // Generate executive recommendations
  async generateExecutiveRecommendations(dashboard) {
    const recommendations = [];
    
    // Bot performance recommendations
    if (parseFloat(dashboard.overview.avgConfidence) < 70) {
      recommendations.push({
        category: 'bot_performance',
        priority: 'high',
        title: 'Improve Bot Confidence',
        description: `Average confidence is ${dashboard.overview.avgConfidence}%. Review response patterns and feedback.`,
        actionItems: [
          'Review low-confidence responses',
          'Update response templates',
          'Collect more feedback data'
        ],
        expectedImpact: 'Higher auto-send rate and better user satisfaction'
      });
    }
    
    // Team engagement recommendations
    if (dashboard.overview.activeUsers > 0 && dashboard.overview.totalMessages / dashboard.overview.activeUsers < 5) {
      recommendations.push({
        category: 'team_engagement',
        priority: 'medium',
        title: 'Boost Team Engagement',
        description: 'Low message per user ratio detected. Consider engagement initiatives.',
        actionItems: [
          'Schedule team check-ins',
          'Review blockers and challenges',
          'Recognize active contributors'
        ],
        expectedImpact: 'Improved collaboration and productivity'
      });
    }
    
    // Learning system recommendations
    if (parseFloat(dashboard.learningMetrics.avgSuccessRate) < 60) {
      recommendations.push({
        category: 'learning_system',
        priority: 'medium',
        title: 'Optimize Learning Patterns',
        description: `Learning success rate is ${dashboard.learningMetrics.avgSuccessRate}%. Review and update patterns.`,
        actionItems: [
          'Analyze low-performing patterns',
          'Update response templates',
          'Collect more user feedback'
        ],
        expectedImpact: 'Better response quality and adaptation'
      });
    }
    
    // EOD completion recommendations
    if (dashboard.teamInsights && parseFloat(dashboard.teamInsights.overview.eodCompletionRate) < 80) {
      recommendations.push({
        category: 'process_compliance',
        priority: 'high',
        title: 'Improve EOD Completion',
        description: `EOD completion rate is ${dashboard.teamInsights.overview.eodCompletionRate}%. Implement reminders.`,
        actionItems: [
          'Set up automated EOD reminders',
          'Review EOD process barriers',
          'Manager follow-up on missing updates'
        ],
        expectedImpact: 'Better project visibility and tracking'
      });
    }
    
    // Proactive insights recommendations
    if (dashboard.proactiveInsights && dashboard.proactiveInsights.pendingRisks.length > 0) {
      const highRiskCount = dashboard.proactiveInsights.pendingRisks.filter(r => r.severity === 'high').length;
      if (highRiskCount > 0) {
        recommendations.push({
          category: 'risk_management',
          priority: 'high',
          title: 'Address Team Risks',
          description: `${highRiskCount} high-priority risks identified. Immediate action required.`,
          actionItems: [
            'Review identified risks',
            'Implement mitigation strategies',
            'Schedule risk assessment meeting'
          ],
          expectedImpact: 'Reduced project delays and improved delivery'
        });
      }
    }
    
    return recommendations;
  },

  // Format dashboard for Slack display
  formatForSlack(dashboard) {
    let message = `📊 *Team Analytics Dashboard* (${dashboard.overview.period})\n\n`;
    
    // Overview section
    message += `📈 *Overview*\n`;
    message += `• Health Score: ${dashboard.healthScore}/100\n`;
    message += `• Active Users: ${dashboard.overview.activeUsers}\n`;
    message += `• Bot Responses: ${dashboard.overview.botResponses}\n`;
    message += `• Avg Confidence: ${dashboard.overview.avgConfidence}%\n`;
    message += `• Auto-Sent Rate: ${dashboard.overview.autoSentRate}%\n\n`;
    
    // Learning metrics
    message += `🧠 *Learning Metrics*\n`;
    message += `• Patterns Learned: ${dashboard.learningMetrics.totalPatterns}\n`;
    message += `• Success Rate: ${dashboard.learningMetrics.avgSuccessRate}%\n`;
    message += `• FAQ Patterns: ${dashboard.learningMetrics.faqPatterns}\n`;
    message += `• Feedback Impact: ${dashboard.learningMetrics.avgFeedbackImpact}\n\n`;
    
    // Team insights
    if (dashboard.teamInsights) {
      message += `👥 *Team Insights*\n`;
      message += `• EOD Completion: ${dashboard.teamInsights.overview.eodCompletionRate}%\n`;
      message += `• Question Rate: ${dashboard.teamInsights.overview.questionRate}%\n`;
      message += `• Messages/User: ${dashboard.teamInsights.overview.avgMessagesPerUser}\n`;
      message += `• Most Active Day: ${dashboard.teamInsights.overview.mostActiveDay.day}\n\n`;
    }
    
    // Top recommendations
    if (dashboard.recommendations.length > 0) {
      message += `💡 *Top Recommendations*\n`;
      dashboard.recommendations.slice(0, 3).forEach((rec, i) => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        message += `${i+1}. ${priority} ${rec.title}\n`;
      });
      message += '\n';
    }
    
    // Health indicator
    const healthEmoji = dashboard.healthScore >= 80 ? '💚' : dashboard.healthScore >= 60 ? '💛' : '❤️';
    message += `${healthEmoji} Overall Health: ${dashboard.healthScore}/100`;
    
    return message;
  },

  // Generate detailed report (for file export)
  generateDetailedReport(dashboard) {
    const report = {
      generatedAt: new Date().toISOString(),
      period: dashboard.overview.period,
      healthScore: dashboard.healthScore,
      sections: {
        overview: dashboard.overview,
        learning: dashboard.learningMetrics,
        team: dashboard.teamInsights,
        proactive: dashboard.proactiveInsights,
        trends: dashboard.trends,
        recommendations: dashboard.recommendations
      }
    };
    
    return JSON.stringify(report, null, 2);
  },

  // Extract active users from messages
  extractActiveUsers(messages) {
    const users = new Set();
    messages.forEach(msg => {
      if (msg.user_id) users.add(msg.user_id);
    });
    return Array.from(users);
  }
};
