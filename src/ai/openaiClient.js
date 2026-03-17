import OpenAI from 'openai';
import { config } from '../config/slack.js';

export const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export const GPT_MODEL = 'gpt-4o-mini';
