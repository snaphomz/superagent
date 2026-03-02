import pkg from '@slack/bolt';
const { App } = pkg;
import { config } from '../config/slack.js';
import { messageHandler } from './messageHandler.js';

export function createSlackBot() {
  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    socketMode: true,
    signingSecret: config.slack.signingSecret,
  });

  app.message(async ({ message, client }) => {
    await messageHandler.handleMessage(message, client);
  });

  app.action('approve_response', async ({ body, ack, client }) => {
    await ack();
    await messageHandler.handleApproval(body, client);
  });

  app.action('reject_response', async ({ body, ack, client }) => {
    await ack();
    await messageHandler.handleApproval(body, client);
  });

  app.event('team_join', async ({ event, client }) => {
    try {
      const userInfo = await client.users.info({ user: event.user.id });
      await messageHandler.updateTeamMember(userInfo.user);
    } catch (error) {
      console.error('Error handling team_join:', error);
    }
  });

  return app;
}
