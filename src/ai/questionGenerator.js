import { eodDetector } from '../utils/eodDetector.js';

export const questionGenerator = {
  generateEODFollowUpQuestions(text, userName = 'team member') {
    const components = eodDetector.extractUpdateComponents(text);
    const analysis = eodDetector.analyzeCompleteness(components);
    
    const questions = [];
    
    if (analysis.issues.includes('no_clickup_mention')) {
      questions.push({
        type: 'clickup_reminder',
        priority: 'high',
        question: `Have you updated ClickUp with today's progress?`,
      });
    }
    
    if (analysis.issues.includes('no_next_day_plan')) {
      questions.push({
        type: 'next_day_tasks',
        priority: 'high',
        question: `What are your priorities for tomorrow? Do you have clarity on your next tasks?`,
      });
    }
    
    if (analysis.issues.includes('missing_purpose')) {
      questions.push({
        type: 'purpose_clarification',
        priority: 'medium',
        question: `What was the main purpose/goal you were working towards today?`,
      });
    }
    
    if (analysis.issues.includes('missing_process')) {
      questions.push({
        type: 'process_clarification',
        priority: 'medium',
        question: `Can you share what process or approach you used?`,
      });
    }
    
    if (analysis.issues.includes('missing_payoff')) {
      questions.push({
        type: 'payoff_clarification',
        priority: 'medium',
        question: `What was the outcome or payoff from today's work?`,
      });
    }
    
    if (analysis.issues.includes('vague_purpose') && components.purposeContent) {
      questions.push({
        type: 'purpose_detail',
        priority: 'low',
        question: `Can you elaborate more on the purpose? What specific problem were you solving?`,
      });
    }
    
    if (analysis.issues.includes('vague_process') && components.processContent) {
      questions.push({
        type: 'process_detail',
        priority: 'low',
        question: `Could you provide more details on the process you followed?`,
      });
    }
    
    if (components.mentionsTasks && !analysis.issues.includes('no_next_day_plan')) {
      questions.push({
        type: 'task_clarity',
        priority: 'medium',
        question: `Are there any blockers or dependencies for tomorrow's tasks?`,
      });
    }
    
    return questions;
  },

  formatQuestionsAsMessage(questions, userName = 'team member') {
    if (questions.length === 0) {
      return null;
    }
    
    const highPriority = questions.filter(q => q.priority === 'high');
    const mediumPriority = questions.filter(q => q.priority === 'medium');
    const lowPriority = questions.filter(q => q.priority === 'low');
    
    let message = '';
    
    if (highPriority.length > 0) {
      const questionsList = highPriority.map(q => q.question).join('\n• ');
      message += `• ${questionsList}`;
    }
    
    if (mediumPriority.length > 0 && highPriority.length < 2) {
      if (message) message += '\n\n';
      const questionsList = mediumPriority.slice(0, 2 - highPriority.length).map(q => q.question).join('\n• ');
      message += `• ${questionsList}`;
    }
    
    return message.trim();
  },

  shouldAskQuestions(text) {
    const questions = this.generateEODFollowUpQuestions(text);
    const highPriorityQuestions = questions.filter(q => q.priority === 'high');
    
    return highPriorityQuestions.length > 0 || questions.length >= 2;
  },

  getQuestionContext(text) {
    const components = eodDetector.extractUpdateComponents(text);
    const analysis = eodDetector.analyzeCompleteness(components);
    
    return {
      isEODUpdate: eodDetector.isEndOfDayUpdate(text),
      components,
      analysis,
      shouldEngage: eodDetector.shouldEngageProactively(text),
      priority: eodDetector.getEngagementPriority(text),
    };
  },
};
