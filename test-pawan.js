import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;

// Test api.pawan.krd configurations
const testConfigs = [
  {
    name: 'Config 1: api.pawan.krd/v1 with gpt-4o-mini',
    baseURL: 'https://api.pawan.krd/v1',
    model: 'gpt-4o-mini',
  },
  {
    name: 'Config 2: api.pawan.krd/v1 with gpt-3.5-turbo',
    baseURL: 'https://api.pawan.krd/v1',
    model: 'gpt-3.5-turbo',
  },
  {
    name: 'Config 3: api.pawan.krd/v1 with gpt-4',
    baseURL: 'https://api.pawan.krd/v1',
    model: 'gpt-4',
  },
];

async function testConfig(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log(`   baseURL: ${config.baseURL}`);
  console.log(`   model: ${config.model}`);
  console.log(`   API Key (first 20): ${API_KEY?.substring(0, 20)}...`);

  try {
    const openai = new OpenAI({
      apiKey: API_KEY,
      baseURL: config.baseURL,
    });

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from Pawan API" and nothing else.' },
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
  console.log('🔍 Testing api.pawan.krd configurations...\n');

  for (const config of testConfigs) {
    await testConfig(config);
  }
}

main();
