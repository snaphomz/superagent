# Excluded Users from Morning Check-ins

To exclude specific users from receiving morning check-ins, you need to add their Slack user IDs to the `EXCLUDED_USER_IDS` environment variable.

## How to Find User IDs

1. In Slack, click on a user's profile
2. Click "More" → "Copy member ID"
3. The ID will look like: `U01234ABCDE`

## Users to Exclude

Add these users to your `.env` file:

- **Antony** - User ID: (needs to be found)
- **Slackbot** - User ID: USLACKBOT (or similar)
- **Phani Kumar** - User ID: (needs to be found)
- **T Deepthi** - User ID: (needs to be found)

## Configuration

In your `.env` file on Fly.io, add:

```
EXCLUDED_USER_IDS=USLACKBOT,U01234ABCDE,U56789FGHIJ,U98765KLMNO
```

Replace the example IDs with the actual user IDs from Slack.

## Setting on Fly.io

```bash
flyctl secrets set EXCLUDED_USER_IDS="USLACKBOT,U01234ABCDE,U56789FGHIJ,U98765KLMNO"
```

## How It Works

Users in the `EXCLUDED_USER_IDS` list will:
- NOT receive morning check-in messages
- NOT be tracked in the daily_checkins table
- NOT be pinged for non-responses
- NOT receive code push reminders
