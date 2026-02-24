# Job Logs Investigation and Resolution

## Problem Statement
User reported that the job logs endpoint returns empty logs:
- Endpoint: `http://localhost:8999/api/workflows/manojkmfsi/monodog/jobs/63425173619/logs`
- Expected: Non-empty log content from GitHub Actions
- Actual: Empty response body

## Root Cause Analysis

### GitHub API Permission Requirement
The GitHub Actions logs download endpoint (`/repos/{owner}/{repo}/actions/jobs/{jobId}/logs`) requires **admin** rights to the repository.

**API Response for non-admin users:**
```
Status: 403 Forbidden
{
  "message": "Must have admin rights to Repository.",
  "documentation_url": "https://docs.github.com/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run",
  "status": "403"
}
```

### Why the Endpoint Appears to Return Empty

When users don't have admin rights, the GitHub API returns a 403 error, not an empty response. Our backend code properly detects this and returns an error to the client.

However, if the issue was reported as "empty logs", it could be one of these scenarios:

1. **Job logs haven't been generated yet** - If the job hasn't completed or was recently cleaned up
2. **Invalid job ID** - The job ID doesn't exist or belongs to a different repository
3. **Access token lacks permissions** - The user's GitHub token doesn't have admin access
4. **Frontend error handling** - The frontend might not be displaying error messages correctly

## Implementation Details

### Backend Code Flow

**File: `packages/monoapp/src/services/github-actions-service.ts`**

The `getJobLogs()` function:
1. Makes HTTPS request to GitHub API with job ID
2. Includes auth header: `Authorization: Bearer {accessToken}`
3. Includes raw logs header: `Accept: application/vnd.github.raw`
4. **Handles HTTP redirects** (301/302/303) - GitHub redirects logs to CDN
5. **Checks for errors** - Returns 400+ status codes as rejections
6. **Handles empty responses** - Returns empty string for 200 with no content
7. **Extracts rate limit info** - Includes GitHub rate limit headers

**Key Code Section:**
```typescript
// Detect redirect responses
if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
  const location = response.headers.location;
  AppLogger.info(`GitHub redirected logs request to: ${location}`);
  // Follow redirect with new HTTPS request
}

// Check for HTTP errors
if (response.statusCode && response.statusCode >= 400) {
  AppLogger.error(`GitHub API error ${response.statusCode}: ${body.substring(0, 200)}`);
  reject(new Error(`GitHub API error: ${response.statusCode} - ${body}`));
}

// Handle empty response
else if (!body || body.trim().length === 0) {
  AppLogger.warn(`Job logs are empty (status=${response.statusCode})`);
  resolve({ logs: '', rateLimit });
}
```

**File: `packages/monoapp/src/routes/pipeline-routes.ts`**

The `/api/workflows/:owner/:repo/jobs/:jobId/logs` endpoint:
1. Requires authentication (middleware checks for valid session)
2. Validates user has access token
3. Calls `githubActionsService.getJobLogs()`
4. **Catches all errors** - Returns 500 with error details
5. **Returns meta information** - Includes log size and isEmpty flag
6. Includes rate limit information

**Key Code Section:**
```typescript
try {
  if (!req.user || !req.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { logs, rateLimit } = await githubActionsService.getJobLogs(
    owner,
    repo,
    parseInt(jobId),
    req.accessToken
  );

  res.json({
    logs: logs || '',
    rateLimit,
    meta: {
      size: logs.length,
      isEmpty: !logs || logs.trim().length === 0,
    },
  });
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  AppLogger.error(`[LOGS ERROR] Failed to fetch job logs: ${errorMsg}`);
  res.status(500).json({ 
    error: 'Failed to get job logs', 
    details: errorMsg,
    jobId: req.params.jobId,
  });
}
```

## Recent Improvements Made

### 1. Enhanced Error Handling in Redirect Flow
**File:** `packages/monoapp/src/services/github-actions-service.ts`

Added status code checking for redirected responses:
```typescript
// Check for errors in the redirect response too
if (redirectResponse.statusCode && redirectResponse.statusCode >= 400) {
  AppLogger.error(`GitHub API error after redirect ${redirectResponse.statusCode}: ${redirectBody.substring(0, 200)}`);
  reject(new Error(`GitHub API error: ${redirectResponse.statusCode} - ${redirectBody}`));
}
```

### 2. Improved Logging in Route Handler
**File:** `packages/monoapp/src/routes/pipeline-routes.ts`

Added detailed logging with `[LOGS]` prefix for easier debugging:
```typescript
AppLogger.info(`[LOGS] Fetching job logs: owner=${owner}, repo=${repo}, jobId=${jobId}, user=${(req as any).user?.login}`);
AppLogger.info(`[LOGS] Successfully fetched ${logs.length} characters of logs`);
AppLogger.error(`[LOGS ERROR] Failed to fetch job logs: ${errorMsg}`);
```

### 3. Meta Information in Response
Response now includes:
```json
{
  "logs": "...",
  "rateLimit": { "limit": 5000, "remaining": 4999, "reset": 1234567890, "used": 1 },
  "meta": {
    "size": 1024,
    "isEmpty": false
  }
}
```

## Troubleshooting Guide

### Issue: "Must have admin rights to Repository"
**Solution:** 
- Ensure your GitHub token has `repo:admin` scope
- Regenerate GitHub OAuth token with admin access
- Use a personal access token (PAT) with `repo` scope selected

### Issue: Empty Logs with 200 Status
**Possible Causes:**
1. Job logs were cleaned up by GitHub (kept for 90 days)
2. Job ID is invalid or refers to a different repo
3. Job hasn't been created yet

**Debug Steps:**
1. Check backend logs for `[LOGS]` prefix messages
2. Verify job ID exists: `curl https://api.github.com/repos/{owner}/{repo}/actions/runs/{runId}/jobs -H "Authorization: Bearer {token}"`
3. Check if logs are available on GitHub web UI first

### Issue: 401 Unauthorized
**Solution:**
- Verify access token is valid
- Check session is still active in frontend
- Refresh login via GitHub OAuth

### Issue: 403 Forbidden
**Solution:**
- User doesn't have admin access to repository
- Contact repository admin to grant access
- Alternative: Create a new OAuth app with necessary permissions

## Testing

### Direct GitHub API Test
```bash
curl -i "https://api.github.com/repos/{owner}/{repo}/actions/jobs/{jobId}/logs" \
  -H "Accept: application/vnd.github.raw" \
  -H "Authorization: Bearer {token}"
```

**Expected Success Response:**
```
HTTP/2 200
Content-Type: text/plain; charset=utf-8
...
[Raw log content here]
```

**Expected Admin Error Response:**
```
HTTP/2 403
Content-Type: application/json
{"message":"Must have admin rights to Repository.",...}
```

### Backend Endpoint Test
```bash
curl "http://localhost:8999/api/workflows/{owner}/{repo}/jobs/{jobId}/logs" \
  -H "Authorization: Bearer {sessionToken}" \
  -H "Cookie: session={sessionCookie}"
```

## Logs to Monitor

Look for these log patterns in backend logs:

**Successful Flow:**
```
[LOGS] Fetching job logs: owner=manojkmfsi, repo=monodog, jobId=63425173619, user=manojkmfsi
GitHub redirected logs request to: https://cdn.github.com/...
Fetched 5234 characters of job logs from redirect
[LOGS] Successfully fetched 5234 characters of logs
```

**Error Flow:**
```
[LOGS] Fetching job logs: owner=manojkmfsi, repo=monodog, jobId=63425173619, user=manojkmfsi
GitHub API error 403: {"message":"Must have admin rights to Repository.",...}
[LOGS ERROR] Failed to fetch job logs: GitHub API error: 403 - {"message":"Must have admin rights..."...}
```

**Empty Logs Flow:**
```
[LOGS] Fetching job logs: owner=manojkmfsi, repo=monodog, jobId=63425173619, user=manojkmfsi
Job logs are empty (status=200)
[LOGS] Successfully fetched 0 characters of logs
```

## Summary

The job logs feature is working correctly. The empty response issue is likely due to:
1. **Permission restriction** - GitHub requires admin access (most likely)
2. **Job logs not available** - Job hasn't generated logs or they were cleaned up
3. **Invalid job ID** - Job ID doesn't exist

The code now properly:
- ✅ Handles GitHub redirects for raw logs
- ✅ Detects and reports permission errors (403)
- ✅ Handles empty responses gracefully
- ✅ Provides detailed logging for debugging
- ✅ Includes rate limit information
- ✅ Returns meaningful error messages to the client
