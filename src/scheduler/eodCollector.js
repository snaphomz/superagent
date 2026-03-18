import cron from 'node-cron';
import { config } from '../config/slack.js';
import { eodSummary } from './eodSummary.js';
import { messageStore } from '../database/messageStore.js';
import db from '../database/postgres.js';

let eodCollectionJob = null;
let slackClient = null;
let collectionState = {
  isCollecting: false,
  targetDate: null,
  missingMembers: [],
  remindedMembers: new Set(),
  finalReminderSent: false,
  collectionStartTime: null
};

// Recipients
const PHANI_KUMAR_ID = 'U09KQK8V7ST';
const ANTONY_ID = config.target.userId;

export const eodCollector = {
  initialize(client) {
    slackClient = client;
    this.scheduleEODCollection();
    console.log('📝 EOD collector initialized');
  },

  scheduleEODCollection() {
    // Start EOD collection at 5:00 PM IST (6:30 AM PST)
    eodCollectionJob = cron.schedule(
      '0 17 * * 1-6',
      async () => {
        await this.startEODCollection();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  async startEODCollection() {
    try {
      console.log('📝 Starting EOD collection process...');
      
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const todayIST = nowIST.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      
      collectionState = {
        isCollecting: true,
        targetDate: todayIST,
        missingMembers: [],
        remindedMembers: new Set(),
        finalReminderSent: false,
        collectionStartTime: new Date()
      };

      // Get all team members
      const teamQuery = `SELECT user_id, display_name, real_name FROM team_members WHERE is_active = true`;
      const teamResult = await db.query(teamQuery);
      const allTeamMembers = teamResult.rows;

      // Get who has already submitted EOD updates
      const eodQuery = `
        SELECT DISTINCT user_id 
        FROM messages 
        WHERE channel_id = $1 
          AND DATE(to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata') = $2::date
          AND thread_ts IS NULL
          AND (
            text ILIKE '%purpose%'
            OR text ILIKE '%process%'
            OR text ILIKE '%payoff%'
            OR text ILIKE '%update:%'
            OR text ILIKE '%today%tasks%'
            OR text ILIKE '%eod%'
          )
          AND LENGTH(text) > 50
      `;
      
      const eodResult = await db.query(eodQuery, [config.target.channelId, todayIST]);
      const submittedMembers = new Set(eodResult.rows.map(r => r.user_id));

      // Identify missing members
      collectionState.missingMembers = allTeamMembers.filter(member => 
        !submittedMembers.has(member.user_id) && 
        member.user_id !== ANTONY_ID // Exclude Antony from EOD requirement
      );

      console.log(`EOD Status: ${submittedMembers.size}/${allTeamMembers.length} submitted, ${collectionState.missingMembers.length} missing`);

      // If everyone has submitted, send summary immediately
      if (collectionState.missingMembers.length === 0) {
        console.log('✅ All EOD updates received, sending summary immediately');
        await this.sendCompleteSummary();
        return;
      }

      // Send initial nudges to missing members
      await this.sendInitialNudges();

      // Schedule reminder check in 30 minutes
      setTimeout(() => this.checkProgress(), 30 * 60 * 1000);
      
      // Schedule final reminder in 60 minutes
      setTimeout(() => this.sendFinalReminder(), 60 * 60 * 1000);
      
      // Schedule forced summary in 90 minutes if still incomplete
      setTimeout(() => this.sendSummaryWithMissing(), 90 * 60 * 1000);

    } catch (error) {
      console.error('Error starting EOD collection:', error);
    }
  },

  async sendInitialNudges() {
    console.log(`📤 Sending initial EOD nudges to ${collectionState.missingMembers.length} members`);
    
    // Send a single channel-wide message instead of DMs
    const missingNames = collectionState.missingMembers.map(m => 
      m.display_name || m.real_name || `<@${m.user_id}>`
    ).join(', ');
    
    try {
      await slackClient.chat.postMessage({
        channel: config.target.channelId,
        text: `📝 *EOD Collection Started*\n\nWaiting for EOD updates from:\n${missingNames}\n\nPlease share your Purpose, Process, and Payoff for today's work. Thanks! 🙏`,
      });
    } catch (error) {
      console.error('Error sending channel nudge:', error.message);
    }
  },

  async checkProgress() {
    if (!collectionState.isCollecting) return;
    
    console.log('🔍 Checking EOD collection progress...');
    
    // Re-check who has submitted
    const eodQuery = `
      SELECT DISTINCT user_id 
      FROM messages 
      WHERE channel_id = $1 
        AND DATE(to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata') = $2::date
        AND thread_ts IS NULL
        AND (
          text ILIKE '%purpose%'
          OR text ILIKE '%process%'
          OR text ILIKE '%payoff%'
          OR text ILIKE '%update:%'
          OR text ILIKE '%today%tasks%'
          OR text ILIKE '%eod%'
        )
        AND LENGTH(text) > 50
        AND to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata' > $3
    `;
    
    const eodResult = await db.query(eodQuery, [
      config.target.channelId, 
      collectionState.targetDate, 
      collectionState.collectionStartTime
    ]);
    
    const newlySubmitted = new Set(eodResult.rows.map(r => r.user_id));
    const stillMissing = collectionState.missingMembers.filter(m => !newlySubmitted.has(m.user_id));
    
    if (stillMissing.length === 0) {
      console.log('✅ All missing EOD updates received!');
      await this.sendCompleteSummary();
      return;
    }
    
    console.log(`⏳ Still waiting for ${stillMissing.length} EOD updates`);
    
    // Send gentle reminder to channel
    const missingNames = stillMissing.map(m => 
      m.display_name || m.real_name || `<@${m.user_id}>`
    ).join(', ');
    
    try {
      await slackClient.chat.postMessage({
        channel: config.target.channelId,
        text: `👋 *Gentle EOD Reminder*\n\nStill waiting for updates from:\n${missingNames}\n\nNo worries if you're running late - just share when you can! 🙏`,
      });
    } catch (error) {
      console.error('Error sending reminder:', error.message);
    }
    
    collectionState.missingMembers = stillMissing;
  },

  async sendFinalReminder() {
    if (!collectionState.isCollecting || collectionState.finalReminderSent) return;
    
    console.log('🚨 Sending final EOD reminders');
    
    // Notify Antony and Phani about missing updates
    const missingNames = collectionState.missingMembers.map(m => 
      m.display_name || m.real_name || `<@${m.user_id}>`
    ).join(', ');
    
    await slackClient.chat.postMessage({
      channel: ANTONY_ID,
      text: `📝 *EOD Collection Update*\n\nStill waiting for EOD updates from:\n${missingNames}\n\nSending final reminder now. Will share summary in 30 minutes regardless.`,
    });
    
    await slackClient.chat.postMessage({
      channel: PHANI_KUMAR_ID,
      text: `📝 *EOD Collection Update*\n\nStill waiting for EOD updates from:\n${missingNames}\n\nSending final reminder now. Will share summary in 30 minutes regardless.`,
    });
    
    // Send final reminder to main channel
    try {
      await slackClient.chat.postMessage({
        channel: config.target.channelId,
        text: `⏰ *Final EOD Reminder*\n\nTeam is waiting to wrap up the day! Still need updates from:\n${missingNames}\n\nIf you can't share a full update right now, just a quick status of what you did today would be great. Thanks for understanding! 🙏`,
      });
    } catch (error) {
      console.error('Error sending final reminder:', error.message);
    }
    
    collectionState.finalReminderSent = true;
  },

  async sendSummaryWithMissing() {
    if (!collectionState.isCollecting) return;
    
    console.log('⏰ Sending summary with missing EOD updates');
    
    // Notify Antony and Phani about missing updates
    const missingNames = collectionState.missingMembers.map(m => 
      m.display_name || m.real_name || `<@${m.user_id}>`
    ).join(', ');
    
    await slackClient.chat.postMessage({
      channel: ANTONY_ID,
      text: `📝 *EOD Collection Complete*\n\nSending summary now. Missing updates from:\n${missingNames}\n\nThey may share later, but proceeding with available updates.`,
    });
    
    await slackClient.chat.postMessage({
      channel: PHANI_KUMAR_ID,
      text: `📝 *EOD Collection Complete*\n\nSending summary now. Missing updates from:\n${missingNames}\n\nThey may share later, but proceeding with available updates.`,
    });
    
    await this.sendCompleteSummary();
  },

  async sendCompleteSummary() {
    if (!collectionState.isCollecting) return;
    
    console.log('✅ Sending complete EOD summary');
    
    collectionState.isCollecting = false;
    
    // Import and use the existing daily summary
    const { dailySummary } = await import('./dailySummary.js');
    await dailySummary.sendDailySummary();
    
    // Reset collection state
    collectionState = {
      isCollecting: false,
      targetDate: null,
      missingMembers: [],
      remindedMembers: new Set(),
      finalReminderSent: false,
      collectionStartTime: null
    };
  },

  // Manual trigger for testing
  async triggerEODCollection() {
    console.log('🔀 Manual EOD collection trigger requested');
    console.log('Current state:', collectionState);
    
    if (collectionState.isCollecting) {
      console.log('⚠️ EOD collection already in progress, not starting new one');
      return false;
    }
    
    console.log('✅ Starting manual EOD collection');
    await this.startEODCollection();
    return true;
  },

  // Get current collection status
  getCollectionStatus() {
    return collectionState;
  }
};
