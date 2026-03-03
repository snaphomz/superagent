import { config } from '../config/slack.js';
import db from '../database/postgres.js';

// Jibble channel ID
const JIBBLE_CHANNEL_ID = 'C09GDQ1RX7G';

// Tracked team members (7 total)
const TRACKED_MEMBERS = [
  'Deepthi D',
  'Pavan B',
  'eric',
  'Vyshnavi',
  'Pranati Manthena',
  'Harish K',
  'Sai Deepthi Molugari'
];

export const jibbleMonitor = {
  async handleMessage(message, client) {
    try {
      // Only process messages from Jibble channel
      if (message.channel !== JIBBLE_CHANNEL_ID) {
        return;
      }

      // Only process messages from Jibble app
      if (!message.text || !message.bot_id) {
        return;
      }

      const text = message.text;

      // Parse Jibble notification
      const attendance = this.parseJibbleNotification(text, message.ts);

      if (attendance) {
        await this.saveAttendance(attendance);
        console.log(`✅ Jibble: ${attendance.user_name} - ${attendance.action_type} at ${attendance.timestamp}`);
      }
    } catch (error) {
      console.error('❌ Error handling Jibble message:', error);
    }
  },

  parseJibbleNotification(text, messageTs) {
    // Pattern: "Name jibbled in via Device (Location)"
    // Pattern: "Name jibbled out via Device (Location)"
    // Pattern: "Name started a break via Device (Location)"

    let match;
    let actionType = null;
    let userName = null;
    let deviceInfo = null;

    // Check for "jibbled in"
    match = text.match(/^(.+?)\s+jibbled in\s+via\s+(.+?)$/i);
    if (match) {
      userName = match[1].trim();
      deviceInfo = match[2].trim();
      actionType = 'clock_in';
    }

    // Check for "jibbled out"
    if (!match) {
      match = text.match(/^(.+?)\s+jibbled out\s+via\s+(.+?)$/i);
      if (match) {
        userName = match[1].trim();
        deviceInfo = match[2].trim();
        actionType = 'clock_out';
      }
    }

    // Check for "started a break"
    if (!match) {
      match = text.match(/^(.+?)\s+started a break\s+via\s+(.+?)$/i);
      if (match) {
        userName = match[1].trim();
        deviceInfo = match[2].trim();
        actionType = 'break_start';
      }
    }

    // Check for "ended a break" or "ended break"
    if (!match) {
      match = text.match(/^(.+?)\s+ended (?:a )?break\s+via\s+(.+?)$/i);
      if (match) {
        userName = match[1].trim();
        deviceInfo = match[2].trim();
        actionType = 'break_end';
      }
    }

    // If no match found, return null
    if (!userName || !actionType) {
      return null;
    }

    // Check if this user is in our tracked list
    const isTracked = TRACKED_MEMBERS.some(member => 
      userName.toLowerCase().includes(member.toLowerCase()) || 
      member.toLowerCase().includes(userName.toLowerCase())
    );

    if (!isTracked) {
      return null;
    }

    // Convert Slack timestamp to Date
    const timestamp = new Date(parseFloat(messageTs) * 1000);
    const date = timestamp.toISOString().split('T')[0];

    return {
      user_name: userName,
      action_type: actionType,
      device_info: deviceInfo,
      timestamp: timestamp.toISOString(),
      date: date,
      message_ts: messageTs
    };
  },

  async saveAttendance(attendance) {
    const query = `
      INSERT INTO jibble_attendance 
      (user_name, action_type, device_info, timestamp, date, message_ts)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_name, timestamp) DO NOTHING
    `;

    const values = [
      attendance.user_name,
      attendance.action_type,
      attendance.device_info,
      attendance.timestamp,
      attendance.date,
      attendance.message_ts
    ];

    await db.query(query, values);
  },

  async getDailyAttendance(date) {
    const query = `
      SELECT 
        user_name,
        action_type,
        device_info,
        timestamp,
        message_ts
      FROM jibble_attendance
      WHERE date = $1
      ORDER BY timestamp ASC
    `;

    const result = await db.query(query, [date]);
    return result.rows;
  },

  async getUserAttendance(userName, startDate, endDate) {
    const query = `
      SELECT 
        user_name,
        action_type,
        device_info,
        timestamp,
        date,
        message_ts
      FROM jibble_attendance
      WHERE user_name = $1 
        AND date >= $2 
        AND date <= $3
      ORDER BY timestamp ASC
    `;

    const result = await db.query(query, [userName, startDate, endDate]);
    return result.rows;
  },

  async getWorkHoursSummary(date) {
    const attendance = await this.getDailyAttendance(date);
    
    // Group by user
    const userSessions = {};
    
    attendance.forEach(record => {
      if (!userSessions[record.user_name]) {
        userSessions[record.user_name] = [];
      }
      userSessions[record.user_name].push(record);
    });

    // Calculate work hours for each user
    const summary = {};

    for (const [userName, records] of Object.entries(userSessions)) {
      let clockInTime = null;
      let totalWorkMinutes = 0;
      let totalBreakMinutes = 0;
      let breakStartTime = null;
      let firstClockIn = null;
      let lastClockOut = null;

      records.forEach(record => {
        const timestamp = new Date(record.timestamp);

        if (record.action_type === 'clock_in') {
          clockInTime = timestamp;
          if (!firstClockIn) {
            firstClockIn = timestamp;
          }
        } else if (record.action_type === 'clock_out') {
          if (clockInTime) {
            const workMinutes = (timestamp - clockInTime) / (1000 * 60);
            totalWorkMinutes += workMinutes;
            clockInTime = null;
          }
          lastClockOut = timestamp;
        } else if (record.action_type === 'break_start') {
          breakStartTime = timestamp;
        } else if (record.action_type === 'break_end') {
          if (breakStartTime) {
            const breakMinutes = (timestamp - breakStartTime) / (1000 * 60);
            totalBreakMinutes += breakMinutes;
            breakStartTime = null;
          }
        }
      });

      // If still clocked in, calculate up to now
      if (clockInTime) {
        const now = new Date();
        const workMinutes = (now - clockInTime) / (1000 * 60);
        totalWorkMinutes += workMinutes;
      }

      summary[userName] = {
        first_clock_in: firstClockIn,
        last_clock_out: lastClockOut,
        total_work_hours: (totalWorkMinutes / 60).toFixed(2),
        total_break_minutes: Math.round(totalBreakMinutes),
        status: clockInTime ? 'clocked_in' : (lastClockOut ? 'clocked_out' : 'unknown'),
        records: records
      };
    }

    return summary;
  },

  async generateDailySummary(date) {
    const summary = await this.getWorkHoursSummary(date);
    
    let report = `📊 *Jibble Attendance Summary - ${date}*\n\n`;

    for (const [userName, data] of Object.entries(summary)) {
      report += `👤 *${userName}*\n`;
      
      if (data.first_clock_in) {
        const clockInTime = new Date(data.first_clock_in).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        });
        report += `   ⏰ First Clock In: ${clockInTime}\n`;
      }

      if (data.last_clock_out) {
        const clockOutTime = new Date(data.last_clock_out).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        });
        report += `   🏁 Last Clock Out: ${clockOutTime}\n`;
      }

      report += `   ⏱️ Total Work Hours: ${data.total_work_hours}h\n`;
      
      if (data.total_break_minutes > 0) {
        report += `   ☕ Total Break Time: ${data.total_break_minutes} min\n`;
      }

      report += `   📍 Status: ${data.status === 'clocked_in' ? '🟢 Currently Working' : '⚪ Clocked Out'}\n`;
      report += `\n`;
    }

    return report;
  }
};
