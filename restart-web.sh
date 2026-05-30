#!/bin/bash
# Safe web restart — always clears stale .next cache first
echo "Stopping web server..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

echo "Clearing .next cache..."
rm -rf apps/web/.next

echo "Starting fresh..."
pnpm --filter @liquor/web dev
