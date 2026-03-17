import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Use the provided API key
const API_KEY = 'sk-c88d01h484o0OBL3g_w8Ib6YnSsTCpUQuIWbZ2LKw_c';

const testConfigs = [
  {
    name: 'freeaiapikey.com/v1 with gpt-5',
    baseURL: 'https://freeaiapikey.com/v1',
    model: 'gpt-5',
  },
  {
    name: 'freeaiapikey.com/v1 with gpt-4o',
    baseURL: 'https://freeaiapikey.com/v1',
    model: 'gpt-4o',
  },
];

async function testConfig(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log(`   baseURL: ${config.baseURL}`);
  console.log(`   model: ${config.model}`);
  console.log(`   API Key: ${API_KEY.substring(0, 20)}...`);

  try {
    const openai = new OpenAI({
      apiKey: API_KEY,
      baseURL: config.baseURL,
    });

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from FreeAIAPIKey" and nothing else.' },
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
  console.log('🔍 Testing FreeAIAPIKey with provided key...\n');

  for (const config of testConfigs) {
    await testConfig(config);
  }
}

main();
