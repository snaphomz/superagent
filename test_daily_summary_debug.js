import pkg from '@slack/web-api';
const { WebClient } = pkg;
import dotenv from 'dotenv';
import db from './src/database/postgres.js';
import { jibbleMonitor } from './src/monitors/jibbleMonitor.js';

dotenv.config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function debugDailySummary() {
  try {
    console.log('🔍 Debugging Daily Summary Data Collection\n');
    
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Date: ${today}\n`);
    
    // 1. Check Jibble attendance data
    console.log('1️⃣ Checking Jibble Attendance Data...');
    const jibbleQuery = `
      SELECT COUNT(*) as count, 
             MIN(date) as earliest_date,
             MAX(date) as latest_date
      FROM jibble_attendance
    `;
    const jibbleResult = await db.query(jibbleQuery);
    console.log('   Total Jibble records:', jibbleResult.rows[0].count);
    console.log('   Earliest date:', jibbleResult.rows[0].earliest_date);
    console.log('   Latest date:', jibbleResult.rows[0].latest_date);
    
    // Check today's Jibble data
    const todayJibbleQuery = `
      SELECT user_name, action_type, timestamp
      FROM jibble_attendance
      WHERE date = $1
      ORDER BY timestamp ASC
    `;
    const todayJibble = await db.query(todayJibbleQuery, [today]);
    console.log(`   Today's Jibble records: ${todayJibble.rows.length}`);
    if (todayJibble.rows.length > 0) {
      console.log('   Sample records:');
      todayJibble.rows.slice(0, 5).forEach(row => {
        console.log(`     - ${row.user_name}: ${row.action_type} at ${row.timestamp}`);
      });
    }
    
    // 2. Check OBI channel messages
    console.log('\n2️⃣ Checking OBI Channel Messages...');
    const obiQuery = `
      SELECT COUNT(*) as count,
             MIN(timestamp::date) as earliest_date,
             MAX(timestamp::date) as latest_date
      FROM messages
      WHERE channel_id = 'C08UM4WCYAZ'
    `;
    const obiResult = await db.query(obiQuery);
    console.log('   Total OBI messages:', obiResult.rows[0].count);
    console.log('   Earliest date:', obiResult.rows[0].earliest_date);
    console.log('   Latest date:', obiResult.rows[0].latest_date);
    
    // Check today's OBI messages
    const todayObiQuery = `
      SELECT user_id, text, timestamp
      FROM messages
      WHERE channel_id = 'C08UM4WCYAZ'
        AND DATE(timestamp::timestamp) = $1
      ORDER BY timestamp ASC
    `;
    const todayObi = await db.query(todayObiQuery, [today]);
    console.log(`   Today's OBI messages: ${todayObi.rows.length}`);
    if (todayObi.rows.length > 0) {
      console.log('   Sample messages:');
      todayObi.rows.slice(0, 3).forEach(row => {
        console.log(`     - ${row.user_id}: ${row.text?.substring(0, 50)}...`);
      });
    }
    
    // 3. Check EOD updates
    console.log('\n3️⃣ Checking EOD Updates...');
    const eodQuery = `
      SELECT COUNT(*) as count,
             MIN(timestamp::date) as earliest_date,
             MAX(timestamp::date) as latest_date
      FROM eod_updates
    `;
    const eodResult = await db.query(eodQuery);
    console.log('   Total EOD updates:', eodResult.rows[0].count);
    console.log('   Earliest date:', eodResult.rows[0].earliest_date);
    console.log('   Latest date:', eodResult.rows[0].latest_date);
    
    // Check today's EOD updates
    const todayEodQuery = `
      SELECT user_id, summary, timestamp
      FROM eod_updates
      WHERE DATE(timestamp::timestamp) = $1
      ORDER BY timestamp ASC
    `;
    const todayEod = await db.query(todayEodQuery, [today]);
    console.log(`   Today's EOD updates: ${todayEod.rows.length}`);
    if (todayEod.rows.length > 0) {
      console.log('   Sample updates:');
      todayEod.rows.forEach(row => {
        console.log(`     - ${row.user_id}: ${row.summary?.substring(0, 50)}...`);
      });
    }
    
    // 4. Test Jibble work hours summary
    console.log('\n4️⃣ Testing Jibble Work Hours Summary...');
    const workHoursSummary = await jibbleMonitor.getWorkHoursSummary(today);
    console.log('   Summary:', JSON.stringify(workHoursSummary, null, 2));
    
    console.log('\n✅ Debug complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugDailySummary();
