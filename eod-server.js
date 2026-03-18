import http from 'http';
import { WebClient } from '@slack/web-api';

const PORT = process.env.PORT || 8080;

// Initialize Slack client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const targetChannel = process.env.TARGET_CHANNEL_ID;

// Store EOD responses
const eodResponses = new Set();

// HTTP server
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    console.log(`🌐 HTTP ${req.method} ${req.url} from ${req.headers.host}`);
    
    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        uptime: process.uptime(),
        eod_responses_count: eodResponses.size,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (url.pathname === '/eod/trigger') {
      console.log('🎯 EOD trigger endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      try {
        if (slackClient && targetChannel) {
          await slackClient.chat.postMessage({
            channel: targetChannel,
            text: `📝 *EOD Collection Started*\n\nPlease share your EOD updates:\n• **Purpose**: What you worked on today\n• **Process**: How you did it\n• **Payoff**: The outcome/value\n\nThanks! 🙏`,
          });
          
          res.end(JSON.stringify({ 
            success: true, 
            message: 'EOD collection started - message sent to Slack channel',
            timestamp: new Date().toISOString()
          }));
        } else {
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Slack configuration missing',
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('EOD trigger error:', error);
        res.end(JSON.stringify({ 
          success: false, 
          message: 'EOD trigger failed',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
      return;
    }
    
    if (url.pathname === '/eod/status') {
      console.log('📊 EOD status endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'EOD status endpoint working',
        eod_responses_count: eodResponses.size,
        message: 'EOD collection can be triggered via /eod/trigger',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (url.pathname === '/eod/respond') {
      console.log('🤖 EOD respond endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      // This endpoint can be called to respond to recent EOD updates
      try {
        if (slackClient && targetChannel) {
          // Get recent messages from the channel
          const result = await slackClient.conversations.history({
            channel: targetChannel,
            limit: 10,
          });
          
          const messages = result.messages;
          let respondedCount = 0;
          
          for (const message of messages) {
            // Skip bot messages and already processed messages
            if (message.bot_id || eodResponses.has(message.ts)) continue;
            
            const text = message.text.toLowerCase();
            const isEODUpdate = text.includes('purpose') && text.includes('process') && text.includes('payoff');
            
            if (isEODUpdate) {
              console.log(`✅ Found EOD update from ${message.user}`);
              
              try {
                // React with ✅ to acknowledge
                await slackClient.reactions.add({
                  channel: targetChannel,
                  timestamp: message.ts,
                  name: 'white_check_mark',
                });
                
                // Send a quick acknowledgment
                await slackClient.chat.postMessage({
                  channel: targetChannel,
                  text: `✅ Thanks for the EOD update, <@${message.user}>! 🙏`,
                  thread_ts: message.ts,
                });
                
                eodResponses.add(message.ts);
                respondedCount++;
                
              } catch (error) {
                console.error('Error responding to EOD update:', error);
              }
            }
          }
          
          res.end(JSON.stringify({ 
            success: true, 
            message: `Responded to ${respondedCount} EOD updates`,
            responded_count: respondedCount,
            total_responses: eodResponses.size,
            timestamp: new Date().toISOString()
          }));
        } else {
          res.end(JSON.stringify({ 
            success: false, 
            message: 'Slack configuration missing',
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('EOD respond error:', error);
        res.end(JSON.stringify({ 
          success: false, 
          message: 'EOD respond failed',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
      return;
    }
    
    console.log(`❌ Unknown endpoint: ${url.pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    
  } catch (error) {
    console.error('❌ HTTP Server Error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server listening on 0.0.0.0:${PORT}`);
  console.log('📝 Endpoints available:');
  console.log('   GET /health - Health check');
  console.log('   GET /eod/trigger - Start EOD collection');
  console.log('   GET /eod/status - Check EOD status');
  console.log('   GET /eod/respond - Respond to recent EOD updates');
  console.log('💡 Use /eod/respond after someone posts an EOD update!');
});

console.log('🚀 EOD HTTP server started...');
