// Parse check-in responses for required information
export const responseParser = {
  parseCheckinResponse(text) {
    const result = {
      planningDone: false,
      planningDetails: null,
      discussedWithLead: false,
      leadName: null,
      redditEngaged: false,
      redditDetails: null,
      tasksFinalized: false,
      taskDetails: null,
    };

    const lowerText = text.toLowerCase();

    // Parse planning session
    if (this.containsAffirmative(lowerText, ['plan', '30 min', 'planning'])) {
      result.planningDone = true;
      result.planningDetails = this.extractDetails(text, ['plan', 'planning']);
    }

    // Parse discussion with Eric or Pavan
    if (lowerText.includes('eric') || lowerText.includes('pavan')) {
      result.discussedWithLead = true;
      if (lowerText.includes('eric')) {
        result.leadName = 'eric';
      } else if (lowerText.includes('pavan')) {
        result.leadName = 'pavan';
      }
    }

    // Parse Reddit engagement
    if (this.containsAffirmative(lowerText, ['reddit'])) {
      result.redditEngaged = true;
      result.redditDetails = this.extractDetails(text, ['reddit', 'post', 'comment']);
    }

    // Parse tasks finalized
    if (this.containsAffirmative(lowerText, ['task', 'finalized', 'ready'])) {
      result.tasksFinalized = true;
      result.taskDetails = this.extractDetails(text, ['task', 'today', 'working on']);
    }

    return result;
  },

  containsAffirmative(text, keywords) {
    const affirmatives = ['yes', 'yeah', 'yep', 'done', 'completed', 'finished'];
    const hasKeyword = keywords.some(kw => text.includes(kw));
    const hasAffirmative = affirmatives.some(aff => text.includes(aff));
    return hasKeyword && (hasAffirmative || text.length > 20);
  },

  extractDetails(text, keywords) {
    // Find sentences containing keywords
    const sentences = text.split(/[.!?]\s+/);
    const relevantSentences = sentences.filter(s => 
      keywords.some(kw => s.toLowerCase().includes(kw))
    );
    
    if (relevantSentences.length > 0) {
      return relevantSentences.join('. ').trim();
    }
    
    return text.trim();
  },

  isOneWordResponse(text) {
    const words = text.trim().split(/\s+/);
    return words.length <= 2;
  },

  isVagueResponse(text) {
    const vaguePatterns = [
      /^yes$/i,
      /^no$/i,
      /^done$/i,
      /^ok$/i,
      /^okay$/i,
      /^sure$/i,
      /^yep$/i,
      /^yeah$/i,
      /^nope$/i,
    ];
    
    const trimmed = text.trim();
    return vaguePatterns.some(pattern => pattern.test(trimmed));
  },

  getMissingItems(parsedResponse) {
    const missing = [];
    
    if (!parsedResponse.planningDone || !parsedResponse.planningDetails) {
      missing.push('Planning session details (What did you plan?)');
    }
    
    if (!parsedResponse.discussedWithLead || !parsedResponse.leadName) {
      missing.push('Discussion with Eric or Pavan (Who did you discuss with and what?)');
    }
    
    if (!parsedResponse.redditEngaged || !parsedResponse.redditDetails) {
      missing.push('Reddit engagement (Which posts/comments?)');
    }
    
    if (!parsedResponse.tasksFinalized || !parsedResponse.taskDetails) {
      missing.push('Task details (What are your main tasks today?)');
    }
    
    return missing;
  },

  getVagueItems(parsedResponse, text) {
    const vague = [];
    
    if (parsedResponse.planningDone && (!parsedResponse.planningDetails || parsedResponse.planningDetails.length < 10)) {
      vague.push('Planning session (need more details)');
    }
    
    if (parsedResponse.discussedWithLead && (!parsedResponse.leadName)) {
      vague.push('Discussion (specify Eric or Pavan)');
    }
    
    if (parsedResponse.redditEngaged && (!parsedResponse.redditDetails || parsedResponse.redditDetails.length < 10)) {
      vague.push('Reddit engagement (need specifics)');
    }
    
    if (parsedResponse.tasksFinalized && (!parsedResponse.taskDetails || parsedResponse.taskDetails.length < 10)) {
      vague.push('Tasks (need more details)');
    }
    
    return vague;
  },
};
