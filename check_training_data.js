import { messageStore } from './src/database/messageStore.js';
import { config } from './src/config/slack.js';
import db from './src/database/db.js';

async function checkTrainingData() {
  try {
    console.log('📊 Checking Antony\'s training data...\n');
    
    // Get Antony's messages
    const userMessages = await messageStore.getUserMessages(config.target.userId, 10000);
    console.log(`✅ Total messages from Antony: ${userMessages.length}`);
    
    if (userMessages.length === 0) {
      console.log('\n⚠️  NO TRAINING DATA FOUND!');
      console.log('You need to run the trainer to fetch messages from Slack.');
      console.log('Run: node src/trainer.js\n');
      process.exit(0);
    }
    
    // Get personality profile
    const profile = await messageStore.getPersonalityProfile();
    
    if (!profile) {
      console.log('\n⚠️  No personality profile found!');
      console.log('Run: node src/trainer.js to analyze and create profile\n');
      process.exit(0);
    }
    
    console.log('\n=== PERSONALITY PROFILE ANALYSIS ===\n');
    console.log(`📝 Average Message Length: ${Math.round(profile.avgMessageLength)} characters`);
    console.log(`📊 Total messages analyzed: ${userMessages.length}`);
    
    console.log('\n🎭 Tone Indicators:');
    Object.entries(profile.toneIndicators).forEach(([tone, percentage]) => {
      const bar = '█'.repeat(Math.round(percentage / 5));
      console.log(`  ${tone.padEnd(12)}: ${percentage}% ${bar}`);
    });
    
    console.log('\n💬 Top 10 Common Phrases:');
    profile.commonPhrases.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.phrase}" (used ${p.count} times)`);
    });
    
    console.log('\n😊 Top Emojis:');
    profile.emojiPatterns.slice(0, 10).forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.emoji} (used ${e.count} times)`);
    });
    
    console.log('\n👋 Greeting Patterns:');
    profile.greetingPatterns.slice(0, 5).forEach((g, i) => {
      console.log(`  ${i + 1}. "${g.greeting}" (used ${g.count} times)`);
    });
    
    console.log('\n👋 Closing Patterns:');
    profile.closingPatterns.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. "${c.closing}" (used ${c.count} times)`);
    });
    
    console.log('\n📚 Top 20 Vocabulary Words:');
    const topWords = Object.entries(profile.vocabularyFrequency)
      .slice(0, 20)
      .map(([word, count]) => `${word} (${count})`);
    console.log(`  ${topWords.join(', ')}`);
    
    // Assess data quality
    console.log('\n\n=== DATA QUALITY ASSESSMENT ===\n');
    
    let quality = 'EXCELLENT';
    let recommendations = [];
    
    if (userMessages.length < 50) {
      quality = 'POOR';
      recommendations.push('⚠️  Need at least 50 messages for basic personality analysis');
      recommendations.push('   Current: ' + userMessages.length + ' messages');
    } else if (userMessages.length < 100) {
      quality = 'FAIR';
      recommendations.push('⚠️  100+ messages recommended for better accuracy');
      recommendations.push('   Current: ' + userMessages.length + ' messages');
    } else if (userMessages.length < 200) {
      quality = 'GOOD';
      recommendations.push('✅ Good amount of data');
      recommendations.push('💡 200+ messages would improve phrase detection');
      recommendations.push('   Current: ' + userMessages.length + ' messages');
    } else {
      quality = 'EXCELLENT';
      recommendations.push('✅ Excellent training data quantity!');
      recommendations.push('   ' + userMessages.length + ' messages analyzed');
    }
    
    if (profile.commonPhrases.length < 10) {
      recommendations.push('⚠️  Limited phrase patterns detected');
      recommendations.push('   More messages would help identify speech patterns');
    }
    
    console.log(`Overall Quality: ${quality}\n`);
    recommendations.forEach(r => console.log(r));
    
    console.log('\n=== RECOMMENDATIONS ===\n');
    
    if (userMessages.length < 200) {
      console.log('📈 To improve training data:');
      console.log('   1. Continue using the bot - it learns from every message');
      console.log('   2. Run trainer periodically: node src/trainer.js');
      console.log('   3. Target: 200+ messages for optimal personality matching\n');
    } else {
      console.log('✅ Training data is sufficient!');
      console.log('   The bot should accurately match your communication style.');
      console.log('   Continue using it to refine the profile over time.\n');
    }
    
    console.log('=====================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTrainingData();
