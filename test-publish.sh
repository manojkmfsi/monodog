#!/bin/bash

# Get auth token by logging in
echo "=== Testing Publish Pipeline Creation ==="
echo ""

# First, we need to get an auth token
# For testing, we'll assume there's a user in the system
# You can replace this with actual login if needed

API_BASE="http://localhost:8999"
BEARER_TOKEN="your-token-here"  # This should be set from actual login

# Test data
PACKAGES='["@manojkmfsi/monodog"]'

echo "Testing POST /api/publish/trigger"
echo "=================================="
echo ""
echo "Request:"
echo "POST $API_BASE/publish/trigger"
echo "Body: { \"packages\": $PACKAGES }"
echo ""

curl -X POST "$API_BASE/publish/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  -d "{\"packages\": $PACKAGES}" \
  -v

echo ""
echo ""
echo "Checking database for pipelines..."
sqlite3 /home/manoj/Documents/mjdog/packages/monoapp/prisma/monodog.db \
  "SELECT id, packageName, releaseVersion, currentStatus, triggeredAt FROM ReleasePipeline LIMIT 5;"
