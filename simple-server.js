import http from 'http';

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    console.log(`🌐 HTTP ${req.method} ${req.url} from ${req.headers.host}`);
    
    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (url.pathname === '/eod/trigger') {
      console.log('🎯 EOD trigger endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      // Try to trigger real EOD collection
      try {
        // Load Slack Web API
        const { WebClient } = await import('@slack/web-api');
        
        // Simple EOD trigger that sends a message to main channel
        const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
        const targetChannel = process.env.SLACK_TARGET_CHANNEL_ID;
        
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
        message: 'EOD collection can be triggered via /eod/trigger',
        timestamp: new Date().toISOString()
      }));
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
  console.log(`✅ Simple HTTP server listening on 0.0.0.0:${PORT}`);
  console.log('📝 EOD endpoints available:');
  console.log('   GET /health - Health check');
  console.log('   GET /eod/trigger - Start EOD collection');
  console.log('   GET /eod/status - Check EOD status');
});

console.log('🚀 Simple HTTP server started...');
