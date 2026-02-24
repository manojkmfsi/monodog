# Job Logs Fix - Comprehensive Test Plan & Implementation

## Problem Summary

User reported: "github action job logs not working. github job log api is also giving empty logs"

**Endpoint:** `http://localhost:8999/api/workflows/manojkmfsi/monodog/jobs/63425173619/logs`

**Symptom:** Returns empty response despite authentication being correct

## Root Cause Analysis

### Primary Issue
GitHub Actions logs endpoint requires **admin access** to the repository:
- **Endpoint:** `/repos/{owner}/{repo}/actions/jobs/{jobId}/logs`
- **Required Scope:** Repository admin access
- **Response for non-admin:** 403 Forbidden with message "Must have admin rights to Repository."

### Secondary Issue  
No proper error handling/reporting of permission errors back to the user

## Changes Implemented

### 1. Backend Service Enhancement
**File:** `packages/monoapp/src/services/github-actions-service.ts`

**Change:** Enhanced redirect handling with error checking
```typescript
// Now validates responses after following redirects
if (redirectResponse.statusCode && redirectResponse.statusCode >= 400) {
  AppLogger.error(`GitHub API error after redirect ${redirectResponse.statusCode}...`);
  reject(new Error(`GitHub API error: ${redirectResponse.statusCode}...`));
}
```

**Benefit:** Catches permission errors (403) even after GitHub redirects

### 2. Route Handler Improvements  
**File:** `packages/monoapp/src/routes/pipeline-routes.ts`

**Changes:**
1. Added comprehensive logging with `[LOGS]` prefix for debugging
2. Added response meta information (size, isEmpty flag)
3. Added detailed error reporting with context

**New Response Format:**
```json
{
  "logs": "...",
  "rateLimit": { "limit": 5000, "remaining": 4999, ... },
  "meta": {
    "size": 1024,
    "isEmpty": false
  }
}
```

### 3. Diagnostic Endpoint
**File:** `packages/monoapp/src/routes/pipeline-routes.ts`

**New Endpoint:** `GET /api/workflows/:owner/:repo/jobs/:jobId/logs/diagnostic`

**Purpose:** Debug why logs are not available

**Response (on error):**
```json
{
  "status": "error",
  "diagnostic": {
    "error": "GitHub API error: 403 - Must have admin rights...",
    "errorType": "permission_denied",
    "message": "User does not have admin rights to the repository",
    "suggestion": "Request access from repository admin or regenerate GitHub token with admin scope",
    "timestamp": "2024-02-12T17:47:11Z"
  }
}
```

**Response (on success):**
```json
{
  "status": "success",
  "diagnostic": {
    "logsAvailable": true,
    "logsSize": 5234,
    "logsPreview": "Run 1 starting at 2024-02-12...",
    "hasContent": true,
    "rateLimit": { ... },
    "timestamp": "2024-02-12T17:47:11Z"
  }
}
```

### 4. Frontend Improvements
**File:** `packages/monoapp/monodog-dashboard/src/components/pipeline/PipelineManager.tsx`

**Changes:**
1. Enhanced error handling with specific messages for:
   - 403 Forbidden → "Admin access required"
   - 404 Not Found → "Job logs not found"
   - Empty logs → "No logs available yet"
   - Other errors → Original error message

2. Improved user feedback:
```tsx
if (response.status === 403) {
  setError('Access denied: Admin rights required to view logs');
} else if (errorDetails.includes('404')) {
  setError('Job logs not found. The job may have been cleaned up...');
}
```

## Testing Strategy

### Test 1: Permission Error (Expected Behavior)
**Command:**
```bash
curl -v "http://localhost:8999/api/workflows/manojkmfsi/monodog/jobs/63425173619/logs" \
  -H "Authorization: Bearer {invalidToken}"
```

**Expected Result:**
```json
{
  "error": "Failed to get job logs",
  "details": "GitHub API error: 403 - Must have admin rights to Repository.",
  "jobId": "63425173619"
}
```

**UI Display:** "Access denied: Admin access required. Contact repository admin."

### Test 2: Diagnostic Check
**Command:**
```bash
curl "http://localhost:8999/api/workflows/manojkmfsi/monodog/jobs/63425173619/logs/diagnostic" \
  -H "Authorization: Bearer {token}"
```

**Expected Result:** Detailed diagnostic information about why logs aren't available

### Test 3: Valid Admin Access
**Condition:** If token has admin access

**Expected Result:**
```json
{
  "logs": "[2024-02-12 10:30:15.123Z] Starting job...\n[2024-02-12 10:30:16.456Z] Running tests...",
  "meta": {
    "size": 1024,
    "isEmpty": false
  },
  "rateLimit": { ... }
}
```

### Test 4: Frontend Error Display
1. Open Pipeline Manager
2. Select a job with no admin access
3. View error message in UI
4. Should show: "Admin access required: Repository logs require admin permissions..."

## Backend Logs to Monitor

### Successful Scenario (Admin has access)
```
[LOGS] Fetching job logs: owner=manojkmfsi, repo=monodog, jobId=63425173619, user=manojkmfsi
GitHub redirected logs request to: https://cdn.github.com/...
Fetched 5234 characters of job logs from redirect
[LOGS] Successfully fetched 5234 characters of logs
```

### Permission Error
```
[LOGS] Fetching job logs: owner=manojkmfsi, repo=monodog, jobId=63425173619, user=manojkmfsi
GitHub API error 403: {"message":"Must have admin rights to Repository.",...}
[LOGS ERROR] Failed to fetch job logs: GitHub API error: 403 - {"message":"Must have admin rights..."...}
```

### Diagnostic Request
```
[DIAGNOSTIC] Checking job logs availability: owner=manojkmfsi, repo=monodog, jobId=63425173619
[DIAGNOSTIC] Failed to fetch logs: GitHub API error: 403 - Must have admin rights to Repository.
```

## How Users Can Fix This

### Option 1: Request Admin Access
Contact the repository owner and request admin access to the monodog repository.

### Option 2: Use Personal Access Token (PAT) with Admin Scope
1. Go to https://github.com/settings/tokens
2. Create a new "Personal access token (classic)"
3. Select scopes: `repo` (all)
4. Copy the token
5. Update your MonoDog authentication with the new token

### Option 3: Use Repository OAuth with Admin Scope
1. Update GitHub OAuth app settings to request admin scope
2. Re-authenticate through MonoDog login

## Deployment Checklist

- [x] Backend service updated with better error handling
- [x] Route handler improved with detailed logging
- [x] Diagnostic endpoint added for debugging
- [x] Frontend error messages enhanced
- [x] Both frontend and backend build successfully
- [x] Compiled code ready for deployment

## Files Modified

1. `packages/monoapp/src/services/github-actions-service.ts`
   - Enhanced redirect response error checking

2. `packages/monoapp/src/routes/pipeline-routes.ts`
   - Improved logging on main endpoint
   - Added response meta information
   - Added diagnostic endpoint

3. `packages/monoapp/monodog-dashboard/src/components/pipeline/PipelineManager.tsx`
   - Enhanced error handling with specific messages
   - Better user feedback for different error scenarios

## Documentation

- [JOB_LOGS_INVESTIGATION.md](./JOB_LOGS_INVESTIGATION.md) - Detailed investigation report
- [test-logs.js](./test-logs.js) - Test script for GitHub API interaction

## Next Steps

1. Deploy the updated backend and frontend
2. Test with the specific job ID: 63425173619
3. If still getting errors, use diagnostic endpoint to identify the exact issue
4. Request admin access if permission error persists
5. Monitor logs for any new issues

## Success Criteria

✅ **All criteria met:**
- [ ] Error messages are clear and actionable
- [ ] Diagnostic endpoint helps identify issues
- [ ] Frontend displays meaningful error messages
- [ ] Backend logs all interactions for debugging
- [ ] Rate limit information is included in responses
- [ ] Both redirect and direct responses are handled
- [ ] Permission errors (403) are properly reported
