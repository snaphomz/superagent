#!/bin/bash
cd /Users/aa/CascadeProjects/windsurf-project
git add -A
git commit -m "feat: Add context enrichment (channel digests) + strike system

- Add channel_digests, strike_records, weekly_strike_summary DB tables
- New: src/ai/channelDigest.js - daily AI-powered channel digest generation
- New: src/scheduler/strikeEvaluator.js - nightly strike scoring
- promptBuilder.js: inject last 3-day digest context + response dedup
- responseGenerator.js: fetch last 5 bot responses to avoid repetition
- messageHandler.js: detect file/screenshot shares, save context annotation
- dailySummary.js: add strike section to Antony+Phani DMs only
- slackBot.js: add !strikes and !digest commands (Antony-only, DM-only)
- index.js: register strikeEvaluator scheduler"
git push origin main
flyctl deploy --remote-only
