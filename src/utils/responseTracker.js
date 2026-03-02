import { messageStore } from '../database/messageStore.js';
import { config } from '../config/slack.js';

export const responseTracker = {
  async createRequest(requestType, messageTs, messageText) {
    try {
      const requestId = await messageStore.createObiRequest(requestType, messageTs, messageText);
      console.log(`✅ Created OBI request #${requestId} (${requestType})`);
      return requestId;
    } catch (error) {
      console.error('❌ Error creating OBI request:', error);
      throw error;
    }
  },

  async updateSummaryPosted(requestId, summaryMessageTs) {
    try {
      await messageStore.updateObiRequestSummary(requestId, summaryMessageTs);
      console.log(`✅ Updated request #${requestId} with summary timestamp`);
    } catch (error) {
      console.error('❌ Error updating summary:', error);
    }
  },

  async trackResponse(summaryMessageTs, userId) {
    try {
      // Find the request by summary message timestamp
      const request = await messageStore.getObiRequestBySummaryTs(summaryMessageTs);
      
      if (!request) {
        console.log('⚠️ No request found for this summary');
        return;
      }

      // Determine which user responded
      let responseType = null;
      if (userId === config.obiTeam.ericUserId) {
        responseType = 'eric';
      } else if (userId === config.obiTeam.pavanUserId) {
        responseType = 'pavan';
      }

      if (!responseType) {
        console.log(`⚠️ Response from non-tracked user: ${userId}`);
        return;
      }

      // Track the response
      await messageStore.trackObiResponse(request.id, userId, responseType);
      console.log(`✅ Tracked ${responseType}'s response to request #${request.id}`);

      // Check if both have responded
      const updatedRequest = await messageStore.getObiRequestBySummaryTs(summaryMessageTs);
      if (updatedRequest.eric_responded_at && updatedRequest.pavan_responded_at) {
        console.log(`🎉 Both Eric and Pavan have responded to request #${request.id}`);
      }
    } catch (error) {
      console.error('❌ Error tracking response:', error);
    }
  },

  async checkPendingResponses() {
    try {
      const pending = await messageStore.getPendingObiResponses();
      
      const summary = pending.map(req => {
        const missing = [];
        if (!req.eric_responded_at) missing.push('Eric');
        if (!req.pavan_responded_at) missing.push('Pavan');
        
        return {
          id: req.id,
          type: req.request_type,
          createdAt: req.created_at,
          missingResponses: missing,
        };
      });

      return summary;
    } catch (error) {
      console.error('❌ Error checking pending responses:', error);
      return [];
    }
  },

  async getResponseStatus(requestId) {
    try {
      const request = await messageStore.getObiRequestByMessageTs(requestId);
      
      if (!request) {
        return null;
      }

      return {
        id: request.id,
        type: request.request_type,
        summaryPosted: !!request.summary_posted_at,
        ericResponded: !!request.eric_responded_at,
        pavanResponded: !!request.pavan_responded_at,
        bothResponded: !!(request.eric_responded_at && request.pavan_responded_at),
      };
    } catch (error) {
      console.error('❌ Error getting response status:', error);
      return null;
    }
  },
};
