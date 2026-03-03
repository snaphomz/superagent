# Tracked Team Members

## Jibble Attendance Tracking (7 Members)

The bot tracks attendance for the following 7 team members in the Jibble channel (C09GDQ1RX7G):

1. **Deepthi D**
2. **Pavan B**
3. **eric** (Eric J)
4. **Vyshnavi**
5. **Pranati Manthena**
6. **Harish K**
7. **Sai Deepthi Molugari**

## What's Tracked

For each member, the system automatically logs:
- ✅ Clock In times
- ✅ Clock Out times
- ✅ Break Start times
- ✅ Break End times
- ✅ Total work hours
- ✅ Total break duration
- ✅ Current status (working or clocked out)

## EOD Update Requirements

All team members (except those marked as exempt) are expected to submit end-of-day updates in the main channel (C09RPPPKCLB).

The daily summary will only be sent to Phani Kumar and Antony **after all required team members have submitted their EOD updates**.

## Excluded Members

The following users are excluded from morning check-ins and EOD requirements:
- Antony (U08UHMRV2ES)
- Phani Kumar (U09KQK8V7ST)
- Slackbot (USLACKBOT)
- Alfred (U09QAS25E30) - Freelancer

## Summary Schedule

**Validation Process:**
1. Starting at 6:00 PM IST, bot checks every 30 minutes
2. Verifies all required team members have submitted EOD updates
3. Once all updates are complete, sends daily summary immediately
4. Summary includes:
   - Jibble attendance for all 7 members
   - OBI Team channel activity
   - EOD updates with action items

**Recipients:**
- Phani Kumar (U09KQK8V7ST) - Direct message
- Antony (YOUR_USER_ID) - Direct message

## Manual Commands

- `!jibble summary` - Get current day's Jibble attendance report
- `!daily summary` - Manually trigger daily summary (if implemented)

## Adding/Removing Members

To modify the tracked members list, update:
- `src/monitors/jibbleMonitor.js` - TRACKED_MEMBERS array
- `team_members` table - Set `exempt_from_eod` flag as needed
