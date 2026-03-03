# ClickUp to Slack User Mapping

This file documents how to map ClickUp users to Slack users for @mentions in overdue task notifications.

## Current Mappings

The mapping is defined in `src/monitors/clickupMonitor.js` in the `getSlackMentions` method:

```javascript
const userMapping = {
  'Devarapalli Deepthi': 'U09QAS25E30',
  'deepthi': 'U09QAS25E30',
  // Add more mappings as needed
};
```

## How to Add New Mappings

### Step 1: Get ClickUp Username

1. Go to ClickUp
2. Open a task assigned to the user
3. Note their exact username as it appears in ClickUp

### Step 2: Get Slack User ID

**Method 1: From Slack Profile**
1. Open Slack
2. Click on the user's profile
3. Click "More" → "Copy member ID"

**Method 2: From Slack API**
Use the `!team members` command (if implemented) or check the database:
```sql
SELECT user_id, display_name FROM team_members;
```

### Step 3: Add to Mapping

Edit `src/monitors/clickupMonitor.js` and add the mapping:

```javascript
const userMapping = {
  'ClickUp Username': 'SLACK_USER_ID',
  'clickup_username_lowercase': 'SLACK_USER_ID', // For case-insensitive matching
};
```

### Step 4: Deploy

```bash
git add -A
git commit -m "Add ClickUp to Slack user mapping for [username]"
git push origin main
flyctl deploy
```

## Current Team Members

Based on your team, here are the known members:

| Name | Slack User ID | ClickUp Username |
|------|---------------|------------------|
| Devarapalli Deepthi | U09QAS25E30 | Devarapalli Deepthi |
| Eric | U09034VD8QG | (Add ClickUp username) |
| Pavan | U09QRQLTBPT | (Add ClickUp username) |
| Phani Kumar | U09KQK8V7ST | (Add ClickUp username) |
| Antony | U08UHMRV2ES | (Add ClickUp username) |

## Example Notification

When a task is overdue and assigned to Deepthi:

```
⚠️ Overdue Task Alert

Pre Approval
• Assigned to: @Devarapalli Deepthi
• Due date: 3/31/2026 (5 days overdue)
• Status: to do
• Priority: None

@Devarapalli Deepthi - Please update the due date or add a comment with your progress.

View in ClickUp
```

## Notes

- Mappings are case-sensitive by default
- Add both exact username and lowercase version for better matching
- If no mapping is found, the notification will still be sent but without @mention
- Update mappings whenever new team members join or usernames change
