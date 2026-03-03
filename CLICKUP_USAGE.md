# ClickUp Integration - Usage Guide

## 🎯 Overview

The ClickUp integration monitors a specific list/board and posts task updates to your Slack target channel. It tracks task assignments, status changes, and notifies team members automatically.

---

## 🚀 Quick Start

### Step 1: Authorize ClickUp

Visit this URL to connect your ClickUp workspace:

```
https://app.clickup.com/api?client_id=LCCIMF2N836O58HU8D95I8HXFWNLUXJ6&redirect_uri=https://superagent-bot.fly.dev/auth/clickup/callback
```

**What happens:**
1. You'll be redirected to ClickUp
2. Select your workspace
3. Click "Connect Workspace"
4. You'll see a success message
5. Bot is now authorized!

---

### Step 2: Find Your List ID

Use Slack commands to navigate your ClickUp workspace:

```
!clickup workspaces
```
This shows all your workspaces with their IDs.

```
!clickup spaces <workspace_id>
```
This shows spaces in a workspace. Each space contains folders and lists.

To get the list ID:
1. Go to ClickUp in your browser
2. Open the list you want to monitor
3. Look at the URL: `https://app.clickup.com/WORKSPACE_ID/v/li/LIST_ID`
4. Copy the `LIST_ID` part

---

### Step 3: Configure the List to Monitor

```
!clickup setlist <list_id>
```

Example:
```
!clickup setlist 901234567890
```

**What happens:**
- Bot starts monitoring this list every 5 minutes
- New tasks → Posted to target channel
- Status changes → Posted to target channel
- Assignment changes → Posted to target channel

---

## 📋 Available Commands

All commands are restricted to Antony only.

### `!clickup workspaces`
Lists all your ClickUp workspaces with IDs.

### `!clickup spaces <workspace_id>`
Lists all spaces in a specific workspace.

### `!clickup setlist <list_id>`
Configures which ClickUp list to monitor.

### `!clickup tasks`
Shows current tasks grouped by assignee from the configured list.

---

## 🔔 Notifications

The bot posts to the **target channel** (C09RPPPKCLB) when:

### New Task Created
```
📋 New Task Created

Task Name Here
• Status: To Do
• Assigned to: John, Jane
• Due: 2026-03-15
• Priority: High

View in ClickUp
```

### Task Status Changed
```
✅ Task Status Updated

Task Name Here
• Status: In Progress → Done
• Assigned to: John

View in ClickUp
```

### Task Assignment Changed
```
👤 Task Assignment Updated

Task Name Here
• Now assigned to: Jane, Mike
• Status: In Progress

View in ClickUp
```

---

## ⚙️ How It Works

### Monitoring Schedule
- Checks ClickUp every **5 minutes**
- Compares current state with last known state
- Posts updates only when changes detected

### What's Tracked
- ✅ New tasks added to the list
- ✅ Task status changes
- ✅ Task assignment changes
- ✅ Task assignees (who it's assigned to)
- ✅ Due dates
- ✅ Priority levels

### What's NOT Tracked (Yet)
- ❌ Task comments
- ❌ Task description changes
- ❌ Time tracking
- ❌ Custom field changes

---

## 🎯 Use Cases

### 1. Team Task Board
Monitor your team's main task board and get instant updates in Slack when:
- New tasks are created
- Tasks move to "In Review" or "Done"
- Tasks are reassigned

### 2. Sprint Board
Track sprint progress by monitoring your sprint list:
- See when tasks move through workflow
- Know who's working on what
- Get notified when blockers appear

### 3. Project Tracking
Monitor a specific project list:
- Track project task completion
- See assignment changes
- Monitor due dates

---

## 🔧 Configuration

### Environment Variables

```bash
# Required for OAuth
CLICKUP_CLIENT_ID=LCCIMF2N836O58HU8D95I8HXFWNLUXJ6
CLICKUP_CLIENT_SECRET=77QSAXMR3S0OEO0KVIJ1WV2K567LGKRGY0DQABN10PHFN2Q7SXKCCX772C11CYBZ
CLICKUP_REDIRECT_URI=https://superagent-bot.fly.dev/auth/clickup/callback

# Optional - Set via !clickup setlist command
CLICKUP_LIST_ID=your_list_id
```

### Fly.io Secrets

Already configured:
```bash
flyctl secrets set CLICKUP_CLIENT_ID=LCCIMF2N836O58HU8D95I8HXFWNLUXJ6
flyctl secrets set CLICKUP_CLIENT_SECRET=77QSAXMR3S0OEO0KVIJ1WV2K567LGKRGY0DQABN10PHFN2Q7SXKCCX772C11CYBZ
flyctl secrets set CLICKUP_REDIRECT_URI=https://superagent-bot.fly.dev/auth/clickup/callback
```

---

## 🐛 Troubleshooting

### "ClickUp not authorized yet"
- Visit the authorization URL
- Make sure you complete the OAuth flow
- Check bot logs for OAuth success message

### "No list configured"
- Use `!clickup setlist <list_id>` to configure
- Make sure you have the correct list ID

### Not receiving notifications
- Check that the list ID is correct
- Verify tasks are actually changing in ClickUp
- Check bot logs for errors
- Monitoring runs every 5 minutes, so wait a bit

### Can't find list ID
- Go to ClickUp in browser
- Open the list
- Check URL for the list ID
- Or use `!clickup spaces` to navigate

---

## 📊 Example Workflow

1. **Morning:** Team creates tasks for the day
   - Bot posts: "📋 New Task Created" for each task

2. **During Day:** Team members update task status
   - Bot posts: "🔄 Task Status Updated" when moved to "In Progress"
   - Bot posts: "✅ Task Status Updated" when marked "Done"

3. **Task Reassignment:** Manager reassigns a task
   - Bot posts: "👤 Task Assignment Updated"

4. **Check Progress:** Use `!clickup tasks` to see current state
   - Shows all tasks grouped by assignee
   - See status and due dates at a glance

---

## 🎯 Next Steps

After setup, you can:
- Monitor your main project board
- Track sprint progress
- Get real-time task updates in Slack
- Use commands to check task status anytime

The integration runs automatically in the background!
