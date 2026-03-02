import { messageStore } from '../database/messageStore.js';
import { styleExtractor } from '../utils/styleExtractor.js';
import { config } from '../config/slack.js';

export const personalityAnalyzer = {
  async analyzeAndSaveProfile() {
    console.log('Analyzing personality profile...');
    
    const userMessages = await messageStore.getUserMessages(config.target.userId);
    
    if (userMessages.length === 0) {
      console.log('No user messages found for analysis');
      return null;
    }

    console.log(`Analyzing ${userMessages.length} messages...`);
    
    const profile = styleExtractor.analyzeMessages(userMessages);
    
    if (profile) {
      await messageStore.savePersonalityProfile(profile);
      console.log('Personality profile saved successfully');
      
      console.log('\n=== Personality Profile Summary ===');
      console.log(`Average Message Length: ${Math.round(profile.avgMessageLength)} characters`);
      console.log(`\nTone Indicators:`);
      Object.entries(profile.toneIndicators).forEach(([tone, percentage]) => {
        console.log(`  ${tone}: ${percentage}%`);
      });
      console.log(`\nTop Common Phrases:`);
      profile.commonPhrases.slice(0, 5).forEach(p => {
        console.log(`  "${p.phrase}" (${p.count} times)`);
      });
      console.log(`\nTop Emojis:`);
      profile.emojiPatterns.slice(0, 5).forEach(e => {
        console.log(`  ${e.emoji} (${e.count} times)`);
      });
      console.log('===================================\n');
    }
    
    return profile;
  },

  async getOrCreateProfile() {
    let profile = await messageStore.getPersonalityProfile();
    
    if (!profile) {
      profile = await this.analyzeAndSaveProfile();
    }
    
    return profile;
  },

  async updateProfile() {
    return await this.analyzeAndSaveProfile();
  },
};
