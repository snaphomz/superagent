import { dailySummary } from '../scheduler/dailySummary.js';

export const eodWebhook = {
  // Handle EOD collection trigger via HTTP
  async handleEODTrigger(req, res) {
    try {
      console.log('🔀 EOD trigger received via webhook');
      
      // Trigger EOD collection
      const triggered = await dailySummary.triggerEODCollection();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      if (triggered) {
        res.end(JSON.stringify({ 
          success: true, 
          message: 'EOD collection started successfully',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.end(JSON.stringify({ 
          success: false, 
          message: 'EOD collection already in progress',
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      console.error('Error handling EOD webhook:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }));
    }
  },

  // Handle status check
  async handleStatusCheck(req, res) {
    try {
      const status = dailySummary.getEODCollectionStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: status,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error) {
      console.error('Error handling status check:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }));
    }
  }
};
