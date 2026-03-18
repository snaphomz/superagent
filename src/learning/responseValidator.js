import { adaptivePromptBuilder } from './adaptivePromptBuilder.js';
import { patternsStore } from './patternsStore.js';
import { config } from '../config/slack.js';

export const responseValidator = {
  // Validate response before sending
  async validateResponse(response, context, messageType, confidence) {
    const validation = {
      isValid: true,
      warnings: [],
      suggestions: [],
      adjustedConfidence: confidence,
      shouldSend: true
    };

    // Check core principles (Antony's personality)
    const principlesCheck = this.validateCorePrinciples(response);
    if (!principlesCheck.passed) {
      validation.isValid = false;
      validation.warnings.push(...principlesCheck.violations);
      validation.adjustedConfidence -= 20;
    }

    // Check effectiveness prediction
    const effectiveness = await adaptivePromptBuilder.predictResponseEffectiveness(
      response,
      context,
      messageType
    );
    
    if (effectiveness < 0.5) {
      validation.warnings.push('Low predicted effectiveness');
      validation.adjustedConfidence -= 15;
    }

    // Get improvement suggestions
    const suggestions = await adaptivePromptBuilder.suggestImprovements(
      response,
      context,
      messageType
    );
    validation.suggestions = suggestions;

    // Check against successful patterns
    const patterns = await patternsStore.getTopPatterns(`${messageType}_template`, 5);
    const matchingPatterns = patterns.filter(p => this.matchesPattern(response, p));
    
    if (patterns.length > 0 && matchingPatterns.length === 0) {
      validation.warnings.push("Response doesn't match known successful patterns");
      validation.adjustedConfidence -= 10;
    }

    // Final decision
    if (validation.adjustedConfidence < config.bot.autoSendThreshold) {
      validation.shouldSend = false;
    }

    return validation;
  },

  // Validate Antony's core principles
  validateCorePrinciples(response) {
    const violations = [];
    const text = response.toLowerCase();

    // Check for false hopes
    if (/\b(maybe|possibly|probably|might|could be|perhaps|i think|maybe we can)\b/i.test(response)) {
      violations.push('Contains uncertain language - Antony is certain and affirmative');
    }

    // Check for generic responses
    const genericPhrases = [
      'team is doing well',
      'everything looks good',
      'no issues',
      'on track',
      'things are progressing',
      'the team is progressing'
    ];
    
    if (genericPhrases.some(phrase => text.includes(phrase))) {
      violations.push('Generic response - Antony references specific people and tasks');
    }

    // Check for wellness mentions
    if (/\b(water|hydrate|take a break|rest|wellness|health|coffee|lunch)\b/i.test(response)) {
      violations.push('Wellness mention - Antony focuses on execution, not wellness');
    }

    // Check for overly diplomatic language
    if (/\b(perhaps we could consider|maybe we should|it might be helpful)\b/i.test(response)) {
      violations.push('Too diplomatic - Antony is direct and assertive');
    }

    // Check for questions instead of answers
    if (text.includes('?') && !/\b(what do you need|how can i help|what's blocking)\b/i.test(response)) {
      violations.push('Contains questions - Antony provides answers, not asks questions');
    }

    return {
      passed: violations.length === 0,
      violations
    };
  },

  // Check if response matches a pattern
  matchesPattern(response, pattern) {
    const text = response.toLowerCase();
    
    if (pattern.pattern_key === 'clickup_reminder') {
      return text.includes('clickup');
    }
    
    if (pattern.pattern_key === 'direct_answer') {
      return !text.includes('?') && response.length < 200;
    }
    
    if (pattern.pattern_key === 'specificity_questions') {
      return pattern.value.question_words.some(word => text.includes(word));
    }
    
    if (pattern.pattern_key === 'deadline_focus') {
      return /\b(today|tomorrow|by|end of|deadline|asap)\b/i.test(response);
    }
    
    return false;
  },

  // Generate validation report
  generateReport(validation) {
    let report = '🔍 Response Validation Report:\n';
    
    if (validation.isValid) {
      report += '✅ Response passes all checks\n';
    } else {
      report += '❌ Response has issues:\n';
      validation.warnings.forEach(w => {
        report += `  - ${w}\n`;
      });
    }
    
    if (validation.suggestions.length > 0) {
      report += '\n💡 Suggestions for improvement:\n';
      validation.suggestions.forEach(s => {
        report += `  - ${s}\n`;
      });
    }
    
    report += `\n📊 Confidence: ${validation.adjustedConfidence.toFixed(1)}%`;
    report += `\n📤 Should send: ${validation.shouldSend ? 'Yes' : 'No'}`;
    
    return report;
  },

  // Quick validation for auto-send decisions
  async quickValidate(response, context, messageType) {
    // Just check core principles for speed
    const principlesCheck = this.validateCorePrinciples(response);
    
    if (!principlesCheck.passed) {
      return {
        isValid: false,
        reason: 'Core principle violations',
        violations: principlesCheck.violations
      };
    }

    // Quick effectiveness check
    const effectiveness = await adaptivePromptBuilder.predictResponseEffectiveness(
      response,
      context,
      messageType
    );

    if (effectiveness < 0.3) {
      return {
        isValid: false,
        reason: 'Very low predicted effectiveness',
        effectiveness
      };
    }

    return {
      isValid: true,
      reason: 'Response looks good',
      effectiveness
    };
  }
};
