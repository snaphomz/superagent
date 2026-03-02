import { responseParser } from './responseParser.js';

// Validate check-in response quality
export const responseValidator = {
  validateResponse(text) {
    const result = {
      isValid: false,
      isComplete: false,
      isSpecific: false,
      missingItems: [],
      vagueItems: [],
      parsedData: null,
    };

    // Check if one-word or vague
    if (responseParser.isOneWordResponse(text) || responseParser.isVagueResponse(text)) {
      result.isSpecific = false;
      result.vagueItems.push('Response is too short or vague');
      return result;
    }

    // Parse the response
    const parsed = responseParser.parseCheckinResponse(text);
    result.parsedData = parsed;

    // Check for missing items
    const missing = responseParser.getMissingItems(parsed);
    result.missingItems = missing;
    result.isComplete = missing.length === 0;

    // Check for vague items
    const vague = responseParser.getVagueItems(parsed, text);
    result.vagueItems = vague;
    result.isSpecific = vague.length === 0 && text.length > 30;

    // Overall validity
    result.isValid = result.isComplete && result.isSpecific;

    return result;
  },

  generateClarificationMessage(userId, validation) {
    let message = `<@${userId}> - Thanks for responding! However, I need more details:\n\n`;

    if (validation.missingItems.length > 0) {
      message += `*Missing/Unclear:*\n`;
      validation.missingItems.forEach(item => {
        message += `• ${item}\n`;
      });
    }

    if (validation.vagueItems.length > 0) {
      if (validation.missingItems.length > 0) message += `\n`;
      message += `*Need More Details:*\n`;
      validation.vagueItems.forEach(item => {
        message += `• ${item}\n`;
      });
    }

    message += `\nPlease provide specific information for these items. 📝`;

    return message;
  },

  generateVagueResponseMessage(userId) {
    return `<@${userId}> - I need more specific details in your response. One-word answers like "yes" or "done" aren't sufficient.\n\nPlease elaborate on all four items:\n• Planning session details\n• Discussion with Eric or Pavan\n• Reddit engagement\n• Today's tasks`;
  },
};
