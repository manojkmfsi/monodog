#!/bin/bash

# Test Pipeline and Logs Endpoints
# This script tests the complete pipeline flow

API_BASE="http://localhost:8999"
OWNER="manojkmfsi"
REPO="monodog"
RUN_ID="12345"  # Example ID - will need real one

echo "=========================================="
echo "Pipeline & Logs Endpoint Test Suite"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Test /api/pipelines endpoint (needs auth)
echo -e "${YELLOW}[TEST 1]${NC} GET /api/pipelines - Fetch recent pipelines"
echo "URL: $API_BASE/api/pipelines"
curl -s -X GET "$API_BASE/api/pipelines" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" | jq '.' || echo "No token or error"
echo ""

# 2. Test /api/workflows/:owner/:repo endpoint
echo -e "${YELLOW}[TEST 2]${NC} GET /api/workflows/{owner}/{repo} - Fetch workflow runs"
echo "URL: $API_BASE/api/workflows/$OWNER/$REPO"
curl -s -X GET "$API_BASE/api/workflows/$OWNER/$REPO" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" | jq '.' || echo "No token or error"
echo ""

# 3. Test /api/workflows/:owner/:repo/runs/:runId endpoint
echo -e "${YELLOW}[TEST 3]${NC} GET /api/workflows/{owner}/{repo}/runs/{runId} - Fetch jobs"
echo "URL: $API_BASE/api/workflows/$OWNER/$REPO/runs/$RUN_ID"
curl -s -X GET "$API_BASE/api/workflows/$OWNER/$REPO/runs/$RUN_ID" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" | jq '.' || echo "No token or error"
echo ""

# 4. Test /api/workflows/:owner/:repo/jobs/:jobId/logs endpoint
echo -e "${YELLOW}[TEST 4]${NC} GET /api/workflows/{owner}/{repo}/jobs/{jobId}/logs - Fetch job logs"
echo "URL: $API_BASE/api/workflows/$OWNER/$REPO/jobs/12345/logs"
curl -s -X GET "$API_BASE/api/workflows/$OWNER/$REPO/jobs/12345/logs" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" -v | jq '.' || echo "No token or error"
echo ""

# 5. Check if backend is running
echo -e "${YELLOW}[HEALTH CHECK]${NC} Backend Health"
HEALTH=$(curl -s "$API_BASE/api/health" | jq '.' 2>/dev/null)
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Backend is running${NC}"
  echo "$HEALTH"
else
  echo -e "${RED}✗ Backend is NOT running on port 8999${NC}"
  echo "Start the backend with: npm run dev"
fi
echo ""

echo "=========================================="
echo "Test complete!"
echo "=========================================="
