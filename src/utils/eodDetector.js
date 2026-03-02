export const eodDetector = {
  isEndOfDayUpdate(text) {
    const lowerText = text.toLowerCase();
    
    const eodKeywords = [
      'end of day',
      'end-of-day',
      'eod update',
      'daily update',
      'today\'s update',
      'update:',
      'updates:',
    ];
    
    const hasEODKeyword = eodKeywords.some(keyword => lowerText.includes(keyword));
    
    const hasPurposeProcessPayoff = 
      lowerText.includes('purpose') || 
      lowerText.includes('process') || 
      lowerText.includes('payoff');
    
    const hasUpdateStructure = 
      (text.includes('*Purpose') || text.includes('*Process') || text.includes('*Payoff')) ||
      (text.includes('**Purpose') || text.includes('**Process') || text.includes('**Payoff'));
    
    return hasEODKeyword || hasPurposeProcessPayoff || hasUpdateStructure;
  },

  extractUpdateComponents(text) {
    const components = {
      hasPurpose: false,
      hasProcess: false,
      hasPayoff: false,
      purposeContent: '',
      processContent: '',
      payoffContent: '',
      mentionsClickUp: false,
      mentionsNextDay: false,
      mentionsTasks: false,
    };

    const lowerText = text.toLowerCase();
    
    components.hasPurpose = /\*{1,2}purpose\*{0,2}/i.test(text);
    components.hasProcess = /\*{1,2}process\*{0,2}/i.test(text);
    components.hasPayoff = /\*{1,2}payoff\*{0,2}/i.test(text);
    
    const purposeMatch = text.match(/\*{1,2}purpose\*{0,2}[:\s]*([\s\S]*?)(?=\*{1,2}process|\*{1,2}payoff|$)/i);
    if (purposeMatch) {
      components.purposeContent = purposeMatch[1].trim().substring(0, 200);
    }
    
    const processMatch = text.match(/\*{1,2}process\*{0,2}[:\s]*([\s\S]*?)(?=\*{1,2}payoff|\*{1,2}purpose|$)/i);
    if (processMatch) {
      components.processContent = processMatch[1].trim().substring(0, 200);
    }
    
    const payoffMatch = text.match(/\*{1,2}payoff\*{0,2}[:\s]*([\s\S]*?)$/i);
    if (payoffMatch) {
      components.payoffContent = payoffMatch[1].trim().substring(0, 200);
    }
    
    components.mentionsClickUp = /click\s*up|clickup/i.test(text);
    
    components.mentionsNextDay = /tomorrow|next day|planning|upcoming|will work on/i.test(lowerText);
    
    components.mentionsTasks = /task|todo|to-do|action item/i.test(lowerText);
    
    return components;
  },

  analyzeCompleteness(components) {
    const issues = [];
    
    if (!components.hasPurpose) {
      issues.push('missing_purpose');
    } else if (components.purposeContent.length < 20) {
      issues.push('vague_purpose');
    }
    
    if (!components.hasProcess) {
      issues.push('missing_process');
    } else if (components.processContent.length < 20) {
      issues.push('vague_process');
    }
    
    if (!components.hasPayoff) {
      issues.push('missing_payoff');
    } else if (components.payoffContent.length < 20) {
      issues.push('vague_payoff');
    }
    
    if (!components.mentionsClickUp) {
      issues.push('no_clickup_mention');
    }
    
    if (!components.mentionsNextDay) {
      issues.push('no_next_day_plan');
    }
    
    return {
      isComplete: issues.length === 0,
      issues,
      completenessScore: Math.max(0, 100 - (issues.length * 20)),
    };
  },

  shouldEngageProactively(text) {
    if (!this.isEndOfDayUpdate(text)) {
      return false;
    }
    
    const components = this.extractUpdateComponents(text);
    const analysis = this.analyzeCompleteness(components);
    
    return analysis.issues.length > 0;
  },

  getEngagementPriority(text) {
    const components = this.extractUpdateComponents(text);
    const analysis = this.analyzeCompleteness(components);
    
    if (analysis.issues.includes('no_clickup_mention')) {
      return 'high';
    }
    
    if (analysis.issues.includes('no_next_day_plan')) {
      return 'high';
    }
    
    if (analysis.issues.includes('missing_purpose') || 
        analysis.issues.includes('missing_process') || 
        analysis.issues.includes('missing_payoff')) {
      return 'medium';
    }
    
    if (analysis.issues.length > 0) {
      return 'low';
    }
    
    return 'none';
  },
};
