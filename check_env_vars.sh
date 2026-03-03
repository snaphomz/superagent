#!/bin/bash

echo "Checking Fly.io environment variables for superagent-bot..."
echo ""

# Get all secrets
echo "=== Configured Secrets ==="
flyctl secrets list --app superagent-bot

echo ""
echo "=== Required Environment Variables ==="
echo "✓ Required for app to start:"
echo "  - SLACK_BOT_TOKEN"
echo "  - SLACK_APP_TOKEN"
echo "  - SLACK_SIGNING_SECRET"
echo "  - OPENAI_API_KEY"
echo "  - DATABASE_URL (PostgreSQL connection string)"
echo "  - TARGET_CHANNEL_ID"
echo "  - YOUR_USER_ID"

echo ""
echo "=== Checking if DATABASE_URL is set ==="
flyctl ssh console --app superagent-bot -C "echo \$DATABASE_URL" 2>/dev/null || echo "Could not check DATABASE_URL"

echo ""
echo "To set missing variables, run:"
echo "flyctl secrets set VARIABLE_NAME=value --app superagent-bot"
