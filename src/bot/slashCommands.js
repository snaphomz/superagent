import { view } from '@slack/bolt';

export const slashCommands = {
  // Handle /eod slash command
  async handleEODCommand({ command, ack, client, body }) {
    await ack();
    
    try {
      // Import dailySummary to trigger EOD collection
      const { dailySummary } = await import('../scheduler/dailySummary.js');
      
      // Trigger EOD collection
      const triggered = await dailySummary.triggerEODCollection();
      
      if (triggered) {
        await client.chat.postMessage({
          channel: body.channel_id,
          text: '📝 EOD collection started! Checking who hasn\'t submitted updates...',
        });
      } else {
        await client.chat.postMessage({
          channel: body.channel_id,
          text: '⚠️ EOD collection already in progress.',
        });
      }
      
    } catch (error) {
      console.error('Error handling /eod command:', error);
      await client.chat.postMessage({
        channel: body.channel_id,
        text: '❌ Error triggering EOD collection.',
      });
    }
  },

  // Handle /test slash command
  async handleTestCommand({ command, ack, client, body }) {
    await ack();
    
    try {
      await client.chat.postMessage({
        channel: body.channel_id,
        text: `✅ Slash command working! Received /eod from <@${body.user_id}> in channel <#${body.channel_id}>`,
      });
    } catch (error) {
      console.error('Error handling /test command:', error);
    }
  }
};
