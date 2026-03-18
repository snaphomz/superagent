import { learningScheduler } from './learningScheduler.js';
import { patternsStore } from './patternsStore.js';
import { feedbackStore } from './feedbackStore.js';
import { faqAutomation } from './faqAutomation.js';
import { contextOptimizer } from './contextOptimizer.js';

export const learningCommands = {
  // Handle learning insights command
  async handleLearningInsights(client, channelId) {
    try {
      const insights = await learningScheduler.generateInsightsReport();
      
      if (!insights) {
        await client.chat.postMessage({
          channel: channelId,
          text: '📊 No learning data available yet. The bot needs more interactions to learn patterns.',
        });
        return;
      }
      
      let message = '🧠 *Learning Insights Report*\n\n';
      
      // Top patterns
      if (insights.topPatterns && insights.topPatterns.length > 0) {
        message += '🏆 *Top Performing Patterns:*\n';
        insights.topPatterns.slice(0, 3).forEach((p, i) => {
          const patternName = p.pattern_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          message += `${i + 1}. ${patternName} - ${(p.success_rate * 100).toFixed(1)}% success (${p.usage_count} uses)\n`;
        });
        message += '\n';
      }
      
      // Feedback trends
      if (insights.feedbackTrends && insights.feedbackTrends.length > 0) {
        message += '📈 *Feedback Trends:*\n';
        insights.feedbackTrends.forEach(trend => {
          const emoji = trend.avgImpact > 0 ? '👍' : '📉';
          message += `${emoji} ${trend.type}: ${trend.count} responses\n`;
        });
        message += '\n';
      }
      
      // Success metrics
      if (insights.successMetrics) {
        message += '📊 *Overall Metrics:*\n';
        message += `• Average Success Rate: ${(insights.successMetrics.avgSuccessRate * 100).toFixed(1)}%\n`;
        message += `• Total Pattern Usage: ${insights.successMetrics.totalUsage}\n`;
        message += '\n';
      }
      
      // Improvement areas
      if (insights.improvementAreas && insights.improvementAreas.length > 0) {
        message += '🎯 *Areas for Improvement:*\n';
        insights.improvementAreas.forEach(area => {
          message += `• ${area}\n`;
        });
      } else {
        message += '✅ *Performance:* All systems operating effectively!\n';
      }
      
      // Phase 3: FAQ Statistics
      if (insights.faqStats) {
        message += '\n📚 *FAQ Automation:*\n';
        message += `• Total patterns: ${insights.faqStats.totalPatterns}\n`;
        message += `• Average success: ${(insights.faqStats.averageSuccessRate * 100).toFixed(1)}%\n`;
        if (insights.faqStats.mostUsed) {
          message += `• Most used: "${insights.faqStats.mostUsed.value.question.substring(0, 50)}..." (${insights.faqStats.mostUsed.usage_count} times)\n`;
        }
      }
      
      // Phase 3: Context Optimization
      if (insights.contextWeights) {
        message += '\n⚖️ *Context Weights:*\n';
        const weightEntries = Object.entries(insights.contextWeights).filter(([_, v]) => typeof v === 'number');
        weightEntries.slice(0, 3).forEach(([key, weight]) => {
          const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          message += `• ${displayName}: ${weight.toFixed(2)}\n`;
        });
      }
      
      await client.chat.postMessage({
        channel: channelId,
        text: message,
      });
      
    } catch (error) {
      console.error('Error generating learning insights:', error);
      await client.chat.postMessage({
        channel: channelId,
        text: '❌ Error generating learning insights. Please try again.',
      });
    }
  },

  // Handle pattern details command
  async handlePatternDetails(client, channelId, patternType = 'all') {
    try {
      let patterns = [];
      
      if (patternType === 'all') {
        patterns = await patternsStore.getTopPatterns('style_pattern', 10);
        const eodPatterns = await patternsStore.getTopPatterns('eod_template', 5);
        const questionPatterns = await patternsStore.getTopPatterns('question_template', 5);
        patterns = [...patterns, ...eodPatterns, ...questionPatterns];
      } else {
        patterns = await patternsStore.getTopPatterns(patternType, 10);
      }
      
      if (patterns.length === 0) {
        await client.chat.postMessage({
          channel: channelId,
          text: `📝 No patterns found for type: ${patternType}`,
        });
        return;
      }
      
      let message = `📝 *Pattern Details (${patternType})*\n\n`;
      
      patterns.forEach(p => {
        const patternName = p.pattern_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const successEmoji = p.success_rate > 0.7 ? '🟢' : p.success_rate > 0.5 ? '🟡' : '🔴';
        
        message += `${successEmoji} *${patternName}*\n`;
        message += `   Success: ${(p.success_rate * 100).toFixed(1)}%\n`;
        message += `   Uses: ${p.usage_count}\n`;
        
        if (p.value && typeof p.value === 'string') {
          try {
            const value = JSON.parse(p.value);
            if (value.phrase) {
              message += `   Example: "${value.phrase}"\n`;
            }
            if (value.style) {
              message += `   Style: ${value.style}\n`;
            }
          } catch (e) {
            // Skip JSON parsing errors
          }
        }
        message += '\n';
      });
      
      await client.chat.postMessage({
        channel: channelId,
        text: message,
      });
      
    } catch (error) {
      console.error('Error getting pattern details:', error);
      await client.chat.postMessage({
        channel: channelId,
        text: '❌ Error retrieving pattern details.',
      });
    }
  },

  // Handle recent feedback command
  async handleRecentFeedback(client, channelId, hours = 24) {
    try {
      const feedback = await feedbackStore.getFeedbackPatterns(50);
      
      if (feedback.length === 0) {
        await client.chat.postMessage({
          channel: channelId,
          text: `📊 No feedback data from the last ${hours} hours.`,
        });
        return;
      }
      
      let message = `📊 *Recent Feedback (Last ${hours}h)*\n\n`;
      
      // Group by feedback type
      const grouped = {};
      feedback.forEach(f => {
        const key = f.feedback_type;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(f);
      });
      
      Object.entries(grouped).forEach(([type, items]) => {
        const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        message += `*${typeName}:*\n`;
        
        items.slice(0, 3).forEach(item => {
          const emoji = item.avg_impact > 0 ? '👍' : item.avg_impact < 0 ? '👎' : '➖';
          message += `  ${emoji} ${item.feedback_value}: ${item.frequency} times\n`;
        });
        
        message += '\n';
      });
      
      await client.chat.postMessage({
        channel: channelId,
        text: message,
      });
      
    } catch (error) {
      console.error('Error getting recent feedback:', error);
      await client.chat.postMessage({
        channel: channelId,
        text: '❌ Error retrieving feedback data.',
      });
    }
  },

  // Handle FAQ details command
  async handleFAQDetails(client, channelId) {
    try {
      const faqStats = await faqAutomation.getFAQStats();
      const allFAQs = await faqAutomation.getAllFAQs();
      
      if (allFAQs.length === 0) {
        await client.chat.postMessage({
          channel: channelId,
          text: '📚 No FAQ patterns learned yet. The bot needs more question interactions to build FAQs.',
        });
        return;
      }
      
      let message = '📚 *FAQ Automation Details*\n\n';
      
      // Overview
      message += `*Overview:*\n`;
      message += `• Total patterns: ${faqStats.totalPatterns}\n`;
      message += `• Average success: ${(faqStats.averageSuccessRate * 100).toFixed(1)}%\n`;
      message += `• Most used: ${faqStats.mostUsed ? `"${faqStats.mostUsed.value.question.substring(0, 40)}..." (${faqStats.mostUsed.usage_count}x)` : 'N/A'}\n`;
      message += `• Highest success: ${faqStats.highestSuccess ? `"${faqStats.highestSuccess.value.question.substring(0, 40)}..." (${(faqStats.highestSuccess.success_rate * 100).toFixed(1)}%)` : 'N/A'}\n\n`;
      
      // By type
      message += `*By Question Type:*\n`;
      Object.entries(faqStats.byType).forEach(([type, stats]) => {
        const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const avgSuccess = (stats.totalSuccess / stats.count * 100).toFixed(1);
        message += `• ${typeName}: ${stats.count} patterns (${avgSuccess}% avg success)\n`;
      });
      
      // Top patterns
      message += `\n*Top 5 Patterns:*\n`;
      allFAQs.slice(0, 5).forEach((faq, i) => {
        const success = (faq.success_rate * 100).toFixed(1);
        const question = faq.value.question.substring(0, 60);
        message += `${i+1}. "${question}..." - ${success}% (${faq.usage_count} uses)\n`;
      });
      
      await client.chat.postMessage({
        channel: channelId,
        text: message,
      });
      
    } catch (error) {
      console.error('Error getting FAQ details:', error);
      await client.chat.postMessage({
        channel: channelId,
        text: '❌ Error retrieving FAQ details.',
      });
    }
  },

  // Handle context weights command
  async handleContextWeights(client, channelId) {
    try {
      const weights = await contextOptimizer.getCurrentWeights();
      const report = await contextOptimizer.getOptimizationReport();
      
      let message = '⚖️ *Context Optimization Weights*\n\n';
      
      message += '*Global Weights:*\n';
      Object.entries(weights).forEach(([key, weight]) => {
        if (typeof weight === 'number') {
          const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          message += `• ${displayName}: ${weight.toFixed(2)}\n`;
        }
      });
      
      if (report && report.messageTypeSpecific) {
        message += '\n*Message Type Specific:*\n';
        Object.entries(report.messageTypeSpecific).forEach(([type, typeWeights]) => {
          const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          message += `\n*${typeName}:*\n`;
          Object.entries(typeWeights).forEach(([key, weight]) => {
            if (typeof weight === 'number') {
              const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              message += `  - ${displayName}: ${weight.toFixed(2)}\n`;
            }
          });
        });
      }
      
      await client.chat.postMessage({
        channel: channelId,
        text: message,
      });
      
    } catch (error) {
      console.error('Error getting context weights:', error);
      await client.chat.postMessage({
        channel: channelId,
        text: '❌ Error retrieving context weights.',
      });
    }
  }
};
