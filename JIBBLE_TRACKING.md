# Jibble Attendance Tracking System

## Overview

The bot now monitors the Jibble channel (C09GDQ1RX7G) and automatically tracks check-ins, check-outs, and breaks for all team members.

## Tracked Team Members

- Deepthi D
- Pavan B
- Eric J / eric
- Vyshnavi
- Pranati Manthena
- Harish K
- Sai Deepthi Molugari

## Features

### 1. Automatic Tracking

The bot monitors all Jibble notifications and automatically logs:
- **Clock In** - When team members start work
- **Clock Out** - When team members end work
- **Break Start** - When team members take a break
- **Break End** - When team members return from break

### 2. Data Captured

For each event, the system records:
- User name
- Action type (clock_in, clock_out, break_start, break_end)
- Device information (Android/iOS with location)
- Timestamp
- Date

### 3. Work Hours Calculation

The system automatically calculates:
- First clock-in time of the day
- Last clock-out time of the day
- Total work hours
- Total break time
- Current status (clocked in or clocked out)

## Usage

### Get Daily Attendance Summary

Type in any channel:
```
!jibble summary
```

This will show:
- All team members who worked today
- Their clock-in and clock-out times
- Total work hours
- Break duration
- Current status (working or clocked out)

### Example Output

```
📊 Jibble Attendance Summary - 2026-03-02

👤 Deepthi D
   ⏰ First Clock In: 07:53 PM
   🏁 Last Clock Out: 11:05 PM
   ⏱️ Total Work Hours: 3.20h
   ☕ Total Break Time: 15 min
   📍 Status: ⚪ Clocked Out

👤 Pavan B
   ⏰ First Clock In: 08:02 PM
   ⏱️ Total Work Hours: 3.05h
   📍 Status: 🟢 Currently Working
```

## Database

All attendance data is stored in the `jibble_attendance` table:
- Indexed by user and date for fast queries
- Prevents duplicate entries
- Retains full history for analytics

## Jibble Notification Format

The bot recognizes these patterns:
- `Name jibbled in via Device (Location)`
- `Name jibbled out via Device (Location)`
- `Name started a break via Device (Location)`
- `Name ended a break via Device (Location)`

## Setup

### Add Bot to Jibble Channel

1. Go to Jibble channel (C09GDQ1RX7G)
2. Type `/invite @Super Agent`
3. Bot will start tracking automatically

### No Configuration Needed

The bot automatically:
- Monitors the channel
- Parses Jibble notifications
- Logs all attendance data
- Calculates work hours

## Future Enhancements

Potential additions:
- Weekly/monthly attendance reports
- Late arrival alerts
- Early departure notifications
- Break duration warnings
- Attendance analytics dashboard
- Export to CSV/Excel
