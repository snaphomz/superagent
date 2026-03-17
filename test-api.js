import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;

// Test different configurations
const testConfigs = [
  {
    name: 'Config 1: freeaiapikey.com/v1 with gpt-4o-mini',
    baseURL: 'https://freeaiapikey.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    name: 'Config 2: freeaiapikey.com/v1 with gpt-4',
    baseURL: 'https://freeaiapikey.com/v1',
    model: 'gpt-4',
  },
  {
    name: 'Config 3: freeaiapikey.com (no /v1) with gpt-4o-mini',
    baseURL: 'https://freeaiapikey.com',
    model: 'gpt-4o-mini',
  },
  {
    name: 'Config 4: freeaiapikey.com/v1/chat/completions with gpt-4o-mini',
    baseURL: 'https://freeaiapikey.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
];

async function testConfig(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log(`   baseURL: ${config.baseURL}`);
  console.log(`   model: ${config.model}`);

  try {
    const openai = new OpenAI({
      apiKey: API_KEY,
      baseURL: config.baseURL,
    });

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from freeaiapikey" and nothing else.' },
      ],
      temperature: 0,
      max_tokens: 50,
    });

    console.log(`   ✅ SUCCESS: ${response.choices[0].message.content}`);
    return true;
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.name}: ${error.message}`);
    if (error.status) console.log(`   Status: ${error.status}`);
    if (error.code) console.log(`   Code: ${error.code}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing freeaiapikey.com configurations...\n');
  console.log(`API Key (first 20 chars): ${API_KEY?.substring(0, 20)}...`);

  for (const config of testConfigs) {
    await testConfig(config);
  }

  // Test default OpenAI endpoint for comparison
  console.log('\n🧪 Testing: Default OpenAI endpoint (for comparison)');
  try {
    const openai = new OpenAI({
      apiKey: API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from OpenAI" and nothing else.' },
      ],
      temperature: 0,
      max_tokens: 50,
    });

    console.log(`   ✅ SUCCESS: ${response.choices[0].message.content}`);
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.name}: ${error.message}`);
  }
}

main();
