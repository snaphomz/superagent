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

**AI-Powered Analysis:**
The bot uses GPT-4o-mini to analyze EOD updates and identify:
- 🚩 **Red Flags**: Missing information, blockers, delays
- 💡 **Insights**: Patterns, trends, team coordination issues
- 📊 **Executive Summary**: High-level overview of daily progress
- ⚠️ **Potential Issues**: Ambiguity, unclear next steps, dependencies

## Recipients

The summary is sent as a **direct message** to:
- **Phani Kumar** (U09KQK8V7ST)
- **Antony** (YOUR_USER_ID)

## Schedule

- **Checking Period:** 6:00 PM - 11:00 PM IST
- **Check Frequency:** Every 30 minutes
- **Sends When:** All team members have submitted EOD updates
- **Timezone:** Asia/Kolkata (IST)

The bot checks every 30 minutes starting at 6:00 PM IST. Once all required team members have submitted their EOD updates, the summary is generated and sent immediately.

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

🤖 AI Analysis

🚩 Red Flags:
• 2 team members mentioned blockers
• 1 task has unclear timeline

💡 Key Insights:
• Strong progress on AI integration features
• Testing phase for multiple components
• Coordination needed between frontend and backend teams

📊 Executive Summary:
Team made solid progress on core features. Testing phase active with some blockers identified. Clear action items for tomorrow.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated at 8:30:00 PM IST
```

## Benefits

1. **Single consolidated view** of all daily activities
2. **Automatic delivery** - no manual effort required
3. **Consistent format** - easy to review and compare
4. **Action-oriented** - highlights what needs attention
5. **AI-powered insights** - identifies red flags and patterns automatically
6. **Executive summary** - high-level overview for quick scanning
7. **Historical record** - can reference past summaries

## Current AI Features

✅ **Already Implemented:**
- AI-generated insights and red flag detection
- Automated analysis of EOD updates
- Executive summaries
- Pattern identification
- Ambiguity detection

## Future Enhancements

Potential additions:
- Week-over-week comparisons
- Productivity metrics and trends
- Automated action item extraction with priority
- Enhanced ClickUp integration in summaries
- Export to PDF/email
- Customizable analysis criteria
