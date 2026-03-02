import natural from 'natural';
import compromise from 'compromise';

const tokenizer = new natural.WordTokenizer();

export const styleExtractor = {
  analyzeMessages(messages) {
    if (!messages || messages.length === 0) {
      return null;
    }

    const texts = messages.map(m => m.text).filter(Boolean);
    
    const avgMessageLength = texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
    
    const commonPhrases = this.extractCommonPhrases(texts);
    const toneIndicators = this.analyzeTone(texts);
    const emojiPatterns = this.extractEmojiPatterns(texts);
    const greetingPatterns = this.extractGreetings(texts);
    const closingPatterns = this.extractClosings(texts);
    const vocabularyFrequency = this.analyzeVocabulary(texts);

    return {
      avgMessageLength,
      commonPhrases,
      toneIndicators,
      emojiPatterns,
      greetingPatterns,
      closingPatterns,
      vocabularyFrequency,
    };
  },

  extractCommonPhrases(texts) {
    const phrases = {};
    const minPhraseLength = 3;
    const minOccurrences = 3;

    texts.forEach(text => {
      const words = tokenizer.tokenize(text.toLowerCase());
      
      for (let i = 0; i < words.length - minPhraseLength + 1; i++) {
        for (let len = minPhraseLength; len <= 5 && i + len <= words.length; len++) {
          const phrase = words.slice(i, i + len).join(' ');
          phrases[phrase] = (phrases[phrase] || 0) + 1;
        }
      }
    });

    return Object.entries(phrases)
      .filter(([_, count]) => count >= minOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([phrase, count]) => ({ phrase, count }));
  },

  analyzeTone(texts) {
    const indicators = {
      formal: 0,
      casual: 0,
      direct: 0,
      diplomatic: 0,
      enthusiastic: 0,
      neutral: 0,
    };

    const formalWords = ['please', 'kindly', 'regarding', 'furthermore', 'however', 'therefore'];
    const casualWords = ['hey', 'yeah', 'gonna', 'wanna', 'cool', 'awesome', 'lol'];
    const directWords = ['need', 'must', 'should', 'required', 'immediately', 'asap'];
    const diplomaticWords = ['perhaps', 'might', 'could', 'would appreciate', 'if possible'];
    const enthusiasticWords = ['great', 'excellent', 'amazing', 'fantastic', 'love', '!'];

    texts.forEach(text => {
      const lower = text.toLowerCase();
      
      formalWords.forEach(word => {
        if (lower.includes(word)) indicators.formal++;
      });
      casualWords.forEach(word => {
        if (lower.includes(word)) indicators.casual++;
      });
      directWords.forEach(word => {
        if (lower.includes(word)) indicators.direct++;
      });
      diplomaticWords.forEach(word => {
        if (lower.includes(word)) indicators.diplomatic++;
      });
      enthusiasticWords.forEach(word => {
        if (lower.includes(word)) indicators.enthusiastic++;
      });
      
      if (!text.includes('!') && !text.includes('?')) {
        indicators.neutral++;
      }
    });

    const total = texts.length;
    return Object.fromEntries(
      Object.entries(indicators).map(([key, value]) => [key, (value / total * 100).toFixed(1)])
    );
  },

  extractEmojiPatterns(texts) {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = {};

    texts.forEach(text => {
      const matches = text.match(emojiRegex);
      if (matches) {
        matches.forEach(emoji => {
          emojis[emoji] = (emojis[emoji] || 0) + 1;
        });
      }
    });

    return Object.entries(emojis)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([emoji, count]) => ({ emoji, count }));
  },

  extractGreetings(texts) {
    const greetingPatterns = [
      /^(hi|hello|hey|good morning|good afternoon|morning|afternoon)\b/i,
      /^(what's up|whats up|sup|yo)\b/i,
    ];

    const greetings = {};

    texts.forEach(text => {
      greetingPatterns.forEach(pattern => {
        const match = text.match(pattern);
        if (match) {
          const greeting = match[0].toLowerCase();
          greetings[greeting] = (greetings[greeting] || 0) + 1;
        }
      });
    });

    return Object.entries(greetings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([greeting, count]) => ({ greeting, count }));
  },

  extractClosings(texts) {
    const closingPatterns = [
      /(thanks|thank you|thx|ty)\b/i,
      /(cheers|regards|best)\b/i,
      /(talk soon|ttyl|see you|bye)\b/i,
    ];

    const closings = {};

    texts.forEach(text => {
      closingPatterns.forEach(pattern => {
        const match = text.match(pattern);
        if (match) {
          const closing = match[0].toLowerCase();
          closings[closing] = (closings[closing] || 0) + 1;
        }
      });
    });

    return Object.entries(closings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([closing, count]) => ({ closing, count }));
  },

  analyzeVocabulary(texts) {
    const wordFreq = {};
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);

    texts.forEach(text => {
      const words = tokenizer.tokenize(text.toLowerCase());
      words.forEach(word => {
        if (word.length > 2 && !stopWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .reduce((obj, [word, count]) => {
        obj[word] = count;
        return obj;
      }, {});
  },

  extractSentenceStructure(texts) {
    const structures = {
      avgSentenceLength: 0,
      questionRatio: 0,
      exclamationRatio: 0,
    };

    let totalSentences = 0;
    let totalWords = 0;
    let questions = 0;
    let exclamations = 0;

    texts.forEach(text => {
      const doc = compromise(text);
      const sentences = doc.sentences().out('array');
      
      totalSentences += sentences.length;
      sentences.forEach(sentence => {
        totalWords += tokenizer.tokenize(sentence).length;
        if (sentence.includes('?')) questions++;
        if (sentence.includes('!')) exclamations++;
      });
    });

    structures.avgSentenceLength = totalSentences > 0 ? (totalWords / totalSentences).toFixed(1) : 0;
    structures.questionRatio = totalSentences > 0 ? ((questions / totalSentences) * 100).toFixed(1) : 0;
    structures.exclamationRatio = totalSentences > 0 ? ((exclamations / totalSentences) * 100).toFixed(1) : 0;

    return structures;
  },
};
