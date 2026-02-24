# Quick Reference: Job Logs Fix Testing

## What Was Fixed

### The Problem
Job logs endpoint returned empty responses instead of:
1. Actual logs (for authorized users)
2. Clear error messages (for unauthorized users)

### The Solution
1. **Enhanced error handling** - Now properly detects and reports permission errors
2. **Diagnostic endpoint** - New `/logs/diagnostic` endpoint to troubleshoot issues
3. **Better error messages** - Frontend now displays specific, actionable error messages
4. **Improved logging** - Backend logs every step for debugging

## Quick Test

### 1. Check Backend is Running
```bash
ps aux | grep "tsx.*src/serve.ts" | grep -v grep
```
Should show one running process.

### 2. Test Diagnostic Endpoint
This shows WHY logs aren't available:

```bash
# Replace {token} with your GitHub session token
curl "http://localhost:8999/api/workflows/manojkmfsi/monodog/jobs/63425173619/logs/diagnostic" \
  -H "Authorization: Bearer {token}" | jq .
```

### 3. Expected Responses

#### If Permission Denied (Most Likely Case)
```json
{
  "status": "error",
  "diagnostic": {
    "error": "GitHub API error: 403 - Must have admin rights to Repository.",
    "errorType": "permission_denied",
    "message": "User does not have admin rights to the repository",
    "suggestion": "Request access from repository admin or regenerate GitHub token with admin scope"
  }
}
```

#### If Logs Available
```json
{
  "status": "success",
  "diagnostic": {
    "logsAvailable": true,
    "logsSize": 5234,
    "logsPreview": "Run 1 starting...",
    "hasContent": true
  }
}
```

#### If Job Not Found
```json
{
  "status": "error",
  "diagnostic": {
    "error": "GitHub API error: 404 - Not Found",
    "errorType": "not_found",
    "message": "Job not found",
    "suggestion": "Verify job ID is correct and job has completed"
  }
}
```

## How to Get Admin Access

### Option 1: Ask Repository Admin
Contact the owner of `manojkmfsi/monodog` repository

### Option 2: Create Personal Access Token (PAT)
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it: "MonoDog Logs Access"
4. Select scopes: Check ✓ `repo` (all options)
5. Generate and copy the token
6. Use it to update your MonoDog session

### Option 3: Check if OAuth App has Admin Scope
If using OAuth, ensure the MonoDog app requests the `admin:repo_hook` scope

## Files Changed

```
packages/monoapp/
├── src/
│   ├── services/github-actions-service.ts     (✓ Enhanced redirect error handling)
│   └── routes/pipeline-routes.ts              (✓ Better logging, diagnostic endpoint)
└── monodog-dashboard/
    └── src/components/pipeline/PipelineManager.tsx  (✓ Better error messages)
```

## Deployment

The changes are ready for deployment:
- ✅ Backend compiled successfully
- ✅ Frontend built successfully
- ✅ No breaking changes
- ✅ Backward compatible

## Monitoring

Watch the backend logs for these patterns:

**Success:**
```
[LOGS] Successfully fetched 5234 characters of logs
```

**Permission Issue:**
```
[LOGS ERROR] Failed to fetch job logs: GitHub API error: 403 - Must have admin rights
```

**Missing Logs:**
```
[LOGS ERROR] Failed to fetch job logs: GitHub API error: 404 - Not Found
```

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Admin access required" | No admin permissions | Request admin access or use PAT with admin scope |
| "Job not found" | Invalid job ID or wrong repo | Verify job ID exists on GitHub web UI |
| "No logs available" | Logs haven't been generated yet | Wait for job to complete |
| Empty response in UI | Stale frontend cache | Hard refresh browser (Ctrl+Shift+R) |

## Backend Log Location

When running `npm run dev`:
- Look for `[LOGS]` prefixed messages
- Look for `[DIAGNOSTIC]` prefixed messages for diagnostic endpoint
- Look for `GitHub redirected` messages when GitHub CDN redirects

## Summary

✅ **All builds successful**
✅ **Error handling improved**
✅ **Diagnostic endpoint ready**
✅ **Frontend error messages enhanced**
✅ **Ready for deployment**

The issue was likely **GitHub permission requirement**. Users without admin access will now get a clear message: "Admin access required: Repository logs require admin permissions. Contact your repository administrator."
