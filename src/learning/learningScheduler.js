import { learningEngine } from './learningEngine.js';
import { feedbackCollector } from './feedbackCollector.js';
import { patternsStore } from './patternsStore.js';
import { messageStore } from '../database/messageStore.js';

export const learningScheduler = {
  // Run learning analysis on recent responses
  async analyzeRecentResponses(hours = 24) {
    try {
      console.log(`🧠 Starting learning analysis for last ${hours} hours...`);
      
      // Get recent responses that haven't been analyzed yet
      const recentLogs = await messageStore.getResponseLogs(100);
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const unanalyzed = recentLogs.filter(log => 
        new Date(log.created_at) > cutoffTime
      );
      
      console.log(`Found ${unanalyzed.length} responses to analyze`);
      
      let totalPatterns = 0;
      let totalSuccess = 0;
      
      for (const log of unanalyzed) {
        try {
          const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
          const messageType = this.detectMessageTypeFromContext(context);
          
          const result = await learningEngine.analyzeResponse(
            log.id, 
            log.generated_response, 
            context, 
            messageType
          );
          
          if (result) {
            totalPatterns += result.patternsLearned;
            totalSuccess += result.successScore;
          }
        } catch (error) {
          console.error(`Error analyzing response ${log.id}:`, error);
        }
      }
      
      console.log(`✅ Learning analysis complete:`);
      console.log(`  - Patterns learned: ${totalPatterns}`);
      console.log(`  - Average success: ${totalSuccess > 0 ? (totalSuccess / unanalyzed.length).toFixed(2) : 'N/A'}`);
      
      return { patternsLearned: totalPatterns, responsesAnalyzed: unanalyzed.length };
    } catch (error) {
      console.error('Learning analysis failed:', error);
      return null;
    }
  },

  // Generate learning insights report
  async generateInsightsReport() {
    try {
      console.log('📊 Generating learning insights report...');
      
      const insights = {
        topPatterns: await this.getTopPatterns(),
        feedbackTrends: await this.getFeedbackTrends(),
        improvementAreas: await this.getImprovementAreas(),
        successMetrics: await this.getSuccessMetrics()
      };
      
      // Log insights to console
      console.log('\n=== LEARNING INSIGHTS ===');
      
      if (insights.topPatterns.length > 0) {
        console.log('\n🏆 Top Performing Patterns:');
        insights.topPatterns.slice(0, 5).forEach((p, i) => {
          console.log(`  ${i+1}. ${p.pattern_key} (success: ${(p.success_rate * 100).toFixed(1)}%, used: ${p.usage_count}x)`);
        });
      }
      
      if (insights.feedbackTrends.length > 0) {
        console.log('\n📈 Feedback Trends:');
        insights.feedbackTrends.forEach(trend => {
          console.log(`  ${trend.type}: ${trend.count} responses (avg impact: ${trend.avgImpact.toFixed(2)})`);
        });
      }
      
      if (insights.improvementAreas.length > 0) {
        console.log('\n🎯 Areas for Improvement:');
        insights.improvementAreas.forEach(area => {
          console.log(`  - ${area}`);
        });
      }
      
      console.log('\n=========================\n');
      
      return insights;
    } catch (error) {
      console.error('Failed to generate insights report:', error);
      return null;
    }
  },

  // Get top performing patterns
  async getTopPatterns() {
    const patterns = await patternsStore.getTopPatterns('style_pattern', 10);
    return patterns.map(p => ({
      ...p,
      value: typeof p.value === 'string' ? JSON.parse(p.value) : p.value
    }));
  },

  // Get feedback trends
  async getFeedbackTrends() {
    // This would need to be implemented in feedbackStore
    // For now, return placeholder data
    return [
      { type: 'Positive reactions', count: 45, avgImpact: 0.15 },
      { type: 'Follow-up questions', count: 12, avgImpact: -0.10 },
      { type: 'Corrections', count: 5, avgImpact: -0.15 }
    ];
  },

  // Get areas needing improvement
  async getImprovementAreas() {
    const areas = [];
    
    // Check for patterns with low success rates
    const patterns = await patternsStore.getTopPatterns('response_template', 20);
    const lowSuccessPatterns = patterns.filter(p => p.success_rate < 0.3 && p.usage_count >= 3);
    
    if (lowSuccessPatterns.length > 0) {
      areas.push('Response templates need refinement (low success rates)');
    }
    
    // Check for high follow-up question rates
    const feedbackPatterns = await patternsStore.getTopPatterns('clarity_pattern', 10);
    const unclearPatterns = feedbackPatterns.filter(p => p.pattern_key.includes('followup'));
    
    if (unclearPatterns.length > 0) {
      areas.push('Responses need more clarity (high follow-up rates)');
    }
    
    return areas;
  },

  // Get overall success metrics
  async getSuccessMetrics() {
    const allPatterns = await patternsStore.getTopPatterns('style_pattern', 50);
    
    if (allPatterns.length === 0) {
      return { avgSuccessRate: 0, totalUsage: 0 };
    }
    
    const avgSuccessRate = allPatterns.reduce((sum, p) => sum + p.success_rate, 0) / allPatterns.length;
    const totalUsage = allPatterns.reduce((sum, p) => sum + p.usage_count, 0);
    
    return { avgSuccessRate, totalUsage };
  },

  // Helper to detect message type from context
  detectMessageTypeFromContext(context) {
    if (!context || !context.newMessage) return 'general';
    
    const text = context.newMessage.text || '';
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('end of day') || lowerText.includes('eod')) {
      return 'eod_update';
    }
    
    if (text.includes('?')) {
      return 'question';
    }
    
    if (lowerText.includes('task') || lowerText.includes('can you')) {
      return 'task_delegation';
    }
    
    return 'general';
  },

  // Initialize learning scheduler
  initialize(client) {
    // Run analysis every 6 hours
    setInterval(async () => {
      await this.analyzeRecentResponses(6);
    }, 6 * 60 * 60 * 1000);
    
    // Generate insights report daily at midnight
    const scheduleDailyReport = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow - now;
      
      setTimeout(async () => {
        await this.generateInsightsReport();
        // Schedule next day
        scheduleDailyReport();
      }, msUntilMidnight);
    };
    
    scheduleDailyReport();
    
    console.log('🧠 Learning scheduler initialized');
    console.log('  - Analysis every 6 hours');
    console.log('  - Daily insights report at midnight');
  }
};
