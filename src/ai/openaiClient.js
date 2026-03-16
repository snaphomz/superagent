import OpenAI from 'openai';
import { config } from '../config/slack.js';

export const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: 'https://freeaiapikey.com/v1',
});

export const GPT_MODEL = 'gpt-5';
