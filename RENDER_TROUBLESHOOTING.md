# Render Database Connection Troubleshooting

## Current Error
```
Error: Connection terminated due to connection timeout
```

This means the web service can't reach the PostgreSQL database.

## Critical Checks

### 1. Database Status
- Go to Render Dashboard → Your PostgreSQL database
- Check the status at the top
- **Must show:** Green "Available" status
- **If showing:** "Creating" or "Suspended" → Wait for it to finish

### 2. Region Match (MOST COMMON ISSUE)
Your web service and database MUST be in the same region.

**Check Web Service Region:**
- Dashboard → `superagent` web service
- Look at "Region" (e.g., Oregon, Frankfurt, Singapore)

**Check Database Region:**
- Dashboard → `slackbot` database  
- Look at "Region"

**If they don't match:**
1. Delete the web service
2. Recreate it in the SAME region as the database
3. Or delete database and recreate in same region as web service

### 3. Verify DATABASE_URL
- Dashboard → `superagent` web service → Environment
- Confirm `DATABASE_URL` exists
- Value should be: `postgresql://slackbot:MhH4JTYtzQU5bedSSPM0XogC6c0PsNdI@dpg-d6itv01drdic73enbi7g-a/slackbot_yzem`

### 4. Database Name Check
Your Internal Database URL shows: `slackbot_yzem`

**Verify this matches:**
- Dashboard → PostgreSQL database → Info tab
- Check "Database" field
- Should match the last part of the URL

## Quick Fix Steps

### Option 1: Recreate Web Service in Same Region
1. Note your database region
2. Delete web service
3. Create new web service
4. **IMPORTANT:** Select same region as database
5. Add all environment variables
6. Deploy

### Option 2: Use External Database URL (Temporary Test)
If regions don't match and you want to test:
1. Get "External Database URL" from database Info tab
2. Update `DATABASE_URL` in web service to use External URL
3. **Note:** This will be slower and costs more bandwidth
4. Better to fix regions for production

## Render Free Tier Limitation

⚠️ **Important:** Render Free tier databases may have connection limits or take time to provision.

**Check:**
- Database created less than 5 minutes ago? → Wait longer
- Database shows "Suspended"? → Free tier may have suspended it
- Too many connection attempts? → Wait 5 minutes and try again

## Alternative: Test Database Connection

Add this to your web service environment variables temporarily:

```
DATABASE_URL=postgresql://slackbot:MhH4JTYtzQU5bedSSPM0XogC6c0PsNdI@dpg-d6itv01drdic73enbi7g-a.oregon-postgres.render.com/slackbot_yzem
```

Notice the `.oregon-postgres.render.com` - this is the external hostname.

If this works, your database is fine but there's a region mismatch.

## What to Check Right Now

1. **Go to your PostgreSQL database page**
   - What's the status? (Available/Creating/Suspended)
   - What's the region?

2. **Go to your web service page**
   - What's the region?

3. **Do they match?**
   - Yes → Check if database is "Available"
   - No → This is your problem!

## Expected Working Logs

When it works, you'll see:
```
Using PostgreSQL database
PostgreSQL database initialized successfully
🚀 Starting Slack Personality Bot...
✅ Personality profile loaded
✅ Bot is running!
```

## Still Not Working?

If regions match and database is Available:
1. Try using External Database URL temporarily
2. Check Render status page: https://status.render.com
3. Contact Render support (they're very responsive)

---

**Tell me:**
1. What region is your database in?
2. What region is your web service in?
3. What's the database status (Available/Creating/Suspended)?
