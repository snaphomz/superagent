import http from 'http';
import { WebClient } from '@slack/web-api';

const PORT = process.env.PORT || 8080;

// Initialize Slack client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const targetChannel = process.env.TARGET_CHANNEL_ID;

// Store EOD responses
const eodResponses = new Set();

// Store shared content tracking
const sharedContent = new Map(); // messageId -> content info
const memberResponses = new Map(); // messageId -> Set of user IDs who responded

// Users to ignore for reminders (you, Phani, Alfred)
const IGNORED_USERS = [
  process.env.YOUR_USER_ID,
  'U09KQK8V7ST', // Phani Kumar (from config)
  // Add Alfred's user ID when you have it
];

// Team members to track (everyone except ignored users)
const teamMembers = new Set();

// Helper function to populate team members
async function populateTeamMembers() {
  try {
    if (slackClient && targetChannel) {
      const result = await slackClient.conversations.members({
        channel: targetChannel,
      });
      
      // Filter out ignored users
      const allMembers = result.members;
      const trackedMembers = allMembers.filter(member => !IGNORED_USERS.includes(member));
      
      trackedMembers.forEach(member => teamMembers.add(member));
      
      console.log(`👥 Populated ${teamMembers.size} team members for tracking`);
      console.log(`🚫 Ignored users: ${IGNORED_USERS.filter(id => id).join(', ')}`);
    }
  } catch (error) {
    console.error('Error populating team members:', error);
  }
}

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
        shared_content_count: sharedContent.size,
        team_members_count: teamMembers.size,
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
    
    if (url.pathname === '/content/scan') {
      console.log('🔍 Content scan endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      try {
        if (slackClient && targetChannel) {
          // Get recent messages from the channel
          const result = await slackClient.conversations.history({
            channel: targetChannel,
            limit: 50,
          });
          
          const messages = result.messages;
          let newContentFound = 0;
          
          for (const message of messages) {
            // Skip bot messages and already processed messages
            if (message.bot_id || sharedContent.has(message.ts)) continue;
            
            // Check if message is from you and contains links
            if (message.user === process.env.YOUR_USER_ID && message.text) {
              const hasLink = message.text.includes('http://') || message.text.includes('https://');
              const hasPDF = message.text.toLowerCase().includes('.pdf');
              
              if (hasLink || hasPDF) {
                console.log(`📎 Found shared content from you: ${message.text.substring(0, 50)}...`);
                
                // Extract the link
                const linkMatch = message.text.match(/https?:\/\/[^\s]+/);
                const link = linkMatch ? linkMatch[0] : null;
                
                // Store the content
                sharedContent.set(message.ts, {
                  type: hasPDF ? 'PDF' : 'Link',
                  link: link,
                  message: message.text,
                  timestamp: message.ts,
                  responses: new Set()
                });
                
                // Initialize responses tracking
                memberResponses.set(message.ts, new Set());
                
                newContentFound++;
                
                // Try to get team members if not already populated
                if (teamMembers.size === 0) {
                  await populateTeamMembers();
                }
              }
            }
          }
          
          res.end(JSON.stringify({ 
            success: true, 
            message: `Found ${newContentFound} new shared content items`,
            new_content_count: newContentFound,
            total_shared_content: sharedContent.size,
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
        console.error('Content scan error:', error);
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Content scan failed',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
      return;
    }
    
    if (url.pathname === '/content/track-responses') {
      console.log('👀 Track responses endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      try {
        if (slackClient && targetChannel) {
          // Get recent messages and reactions
          const result = await slackClient.conversations.history({
            channel: targetChannel,
            limit: 100,
          });
          
          const messages = result.messages;
          let newResponsesFound = 0;
          
          for (const message of messages) {
            // Check if this is a response to shared content
            if (message.thread_ts && sharedContent.has(message.thread_ts)) {
              const contentId = message.thread_ts;
              const responses = memberResponses.get(contentId) || new Set();
              
              // Add responder if not ignored user
              if (!IGNORED_USERS.includes(message.user)) {
                if (!responses.has(message.user)) {
                  responses.add(message.user);
                  newResponsesFound++;
                  console.log(`💬 Found response from ${message.user} to shared content`);
                }
              }
              
              memberResponses.set(contentId, responses);
            }
            
            // Check for reactions on shared content
            if (message.reactions && sharedContent.has(message.ts)) {
              const contentId = message.ts;
              const responses = memberResponses.get(contentId) || new Set();
              
              for (const reaction of message.reactions) {
                for (const user of reaction.users) {
                  // Add reactor if not ignored user and not the content sharer
                  if (!IGNORED_USERS.includes(user) && user !== message.user) {
                    if (!responses.has(user)) {
                      responses.add(user);
                      newResponsesFound++;
                      console.log(`😊 Found reaction from ${user} to shared content`);
                    }
                  }
                }
              }
              
              memberResponses.set(contentId, responses);
            }
          }
          
          res.end(JSON.stringify({ 
            success: true, 
            message: `Found ${newResponsesFound} new responses`,
            new_responses_count: newResponsesFound,
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
        console.error('Track responses error:', error);
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Track responses failed',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
      return;
    }
    
    if (url.pathname === '/content/remind') {
      console.log('📋 Send reminders endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      try {
        if (slackClient && targetChannel) {
          let remindersSent = 0;
          
          for (const [contentId, content] of sharedContent.entries()) {
            const responses = memberResponses.get(contentId) || new Set();
            const missingMembers = Array.from(teamMembers).filter(member => !responses.has(member));
            
            if (missingMembers.length > 0) {
              const missingNames = missingMembers.map(member => `<@${member}>`).join(', ');
              
              await slackClient.chat.postMessage({
                channel: targetChannel,
                text: `📋 *Friendly Reminder*\n\nStill waiting for responses from:\n${missingNames}\n\nPlease check out the ${content.type.toLowerCase()} I shared earlier and share your thoughts! 🙏`,
                thread_ts: contentId
              });
              
              remindersSent++;
              console.log(`📋 Sent reminder for content ${contentId} to ${missingMembers.length} members`);
            }
          }
          
          res.end(JSON.stringify({ 
            success: true, 
            message: `Sent ${remindersSent} reminders`,
            reminders_sent: remindersSent,
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
        console.error('Send reminders error:', error);
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Send reminders failed',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
      return;
    }
    
    if (url.pathname === '/content/status') {
      console.log('📊 Content status endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      const contentStatus = [];
      
      for (const [contentId, content] of sharedContent.entries()) {
        const responses = memberResponses.get(contentId) || new Set();
        const missingMembers = Array.from(teamMembers).filter(member => !responses.has(member));
        
        contentStatus.push({
          content_id: contentId,
          type: content.type,
          link: content.link,
          responses_count: responses.size,
          missing_members: missingMembers.length,
          missing_member_names: missingMembers.map(member => `<@${member}>`)
        });
      }
      
      res.end(JSON.stringify({ 
        success: true, 
        content_status: contentStatus,
        total_shared_content: sharedContent.size,
        team_members_count: teamMembers.size,
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
  console.log(`✅ HTTP server listening on 0.0.0.0:${PORT}`);
  console.log('📝 Endpoints available:');
  console.log('   GET /health - Health check');
  console.log('   GET /eod/trigger - Start EOD collection');
  console.log('   GET /eod/status - Check EOD status');
  console.log('   GET /eod/respond - Respond to recent EOD updates');
  console.log('   GET /content/scan - Scan for new shared content');
  console.log('   GET /content/track-responses - Track responses to shared content');
  console.log('   GET /content/remind - Send reminders to missing members');
  console.log('   GET /content/status - Check content response status');
  console.log('💡 Workflow: /content/scan → /content/track-responses → /content/remind');
});

console.log('🚀 Enhanced EOD + Content Tracking server started...');
