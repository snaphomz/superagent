# Daily Summary System

## Overview

The bot automatically generates and sends a comprehensive daily summary to Phani Kumar and Antony every day at 11:30 PM IST.

## Summary Contents

The daily summary includes three main sections:

### 1. ⏰ Jibble Attendance Report

Tracks all team members from channel C09GDQ1RX7G:
- Deepthi D
- Pavan B
- Eric J / eric
- Vyshnavi
- Pranati Manthena
- Harish K
- Sai Deepthi Molugari

**Information shown:**
- First clock-in time
- Last clock-out time
- Total work hours
- Total break duration
- Current status (working or clocked out)

### 2. 🚀 OBI Team Channel Summary

Summarizes activity from the external deployment channel (C08UM4WCYAZ):
- Deployment updates
- Team conversations
- Key discussions
- Action items

### 3. 📝 EOD Updates & Action Items

Consolidates all end-of-day updates from the main channel (C09RPPPKCLB):
- Team member updates
- Tasks completed
- Planning details
- Reddit engagement
- Action items for next day

## Recipients

The summary is sent as a **direct message** to:
- **Phani Kumar** (U09KQK8V7ST)
- **Antony** (YOUR_USER_ID)

## Schedule

- **Time:** 11:30 PM IST (23:30)
- **Frequency:** Daily
- **Timezone:** Asia/Kolkata

## Format

The summary uses Slack's Block Kit for rich formatting:
- Collapsible sections (can expand/collapse for detail)
- User mentions (@mentions)
- Structured layout
- Easy to scan

## Manual Trigger

To generate and send the summary immediately (for testing):

```javascript
// In Node.js console or test script
import { dailySummary } from './src/scheduler/dailySummary.js';
await dailySummary.sendNow();
```

## Configuration

### Environment Variables

```bash
DAILY_SUMMARY_TIME=23:30  # Time to send daily summary (HH:MM format)
CHECKIN_TIMEZONE=Asia/Kolkata  # Timezone for scheduling
```

### Customization

To change the summary time, update the environment variable:
```bash
flyctl secrets set DAILY_SUMMARY_TIME="22:00"
```

## Data Sources

The summary pulls data from:
1. **jibble_attendance** table - Jibble check-in/out logs
2. **messages** table (C08UM4WCYAZ) - OBI Team channel messages
3. **daily_checkins** table - EOD updates and responses

## Example Summary

```
📊 Daily Summary - 2026-03-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ Jibble Attendance Report
7 team members tracked

Deepthi D
• Clock In: 07:53 PM
• Clock Out: 11:05 PM
• Hours: 3.20h | Breaks: 15m
• Status: ⚪ Clocked Out

Pavan B
• Clock In: 08:02 PM
• Clock Out: Still working
• Hours: 3.47h | Breaks: 0m
• Status: 🟢 Working

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 OBI Team Channel Summary
12 messages in OBI Team channel

External Deployment Updates
12 deployment-related messages tracked

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 EOD Updates & Action Items
5 team members provided EOD updates

@Pavan B
• Update: Tested demo site, documented issues
• Tasks: Fix OBI Team problems quickly
• Planning: Continue testing tomorrow

@Vyshnavi Devi
• Update: Integrated Ask AI button in messaging
• Tasks: Allow buyers to chat with AI privately
• Planning: Test and deploy feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated at 11:30:00 PM IST
```

## Benefits

1. **Single consolidated view** of all daily activities
2. **Automatic delivery** - no manual effort required
3. **Consistent format** - easy to review and compare
4. **Action-oriented** - highlights what needs attention
5. **Historical record** - can reference past summaries

## Future Enhancements

Potential additions:
- AI-generated insights and trends
- Week-over-week comparisons
- Productivity metrics
- Automated action item extraction
- Integration with project management tools
- Export to PDF/email
