# Pipeline Status Update Testing Guide

## Overview
This guide explains the new feature that automatically updates pipeline status and conclusion based on GitHub Actions workflow runs during the publishing process.

## Changes Made

### 1. Backend Service Updates (`src/services/pipeline-service.ts`)
- Added `updatePipelineStatus()` function to update pipeline status in the database
- Function updates:
  - `currentStatus`: The status from the latest workflow run (queued, in_progress, completed)
  - `currentConclusion`: The conclusion (success, failure, cancelled, skipped)
  - `lastRunId`: The GitHub run ID

### 2. API Endpoint (`src/routes/pipeline-routes.ts`)
- Added new `PUT /api/pipelines/:pipelineId/status` endpoint
- Requires authentication
- Body parameters:
  ```json
  {
    "currentStatus": "completed",
    "currentConclusion": "success",
    "lastRunId": 12345
  }
  ```
- Returns the updated pipeline object

### 3. Frontend Updates (`monodog-dashboard/src/components/pipeline/PipelineManager.tsx`)
- Enhanced pipeline fetch logic to:
  1. Fetch all pipelines
  2. For each pipeline, fetch its latest workflow run
  3. Compare status/conclusion - if changed, call the new PUT endpoint
  4. Update local state with latest information
- Polling interval: 10 seconds
- Status updates are persisted to the database

### 4. Pipeline Interface Updates
- Added optional properties:
  - `currentConclusion?: string | null` - tracks failure/success
  - `workflowPath?: string` - reference to workflow file

## How It Works

### During Publishing
When you trigger publishing with changesets:
```
🦋  info Publishing "@monodog/utils" at "1.0.12"
🦋  info Publishing "@monodog/backend" at "1.5.36"
🦋  info Publishing "@monodog/ci-status" at "1.2.16"
```

A pipeline is created with status "queued".

### Status Flow
1. **Initial State**: Pipeline created with `currentStatus: "queued"`, `currentConclusion: null`
2. **In Progress**: Workflow run starts → status becomes `"in_progress"`
3. **Completing**: 
   - If successful: status `"completed"`, conclusion `"success"`
   - If failed: status `"completed"`, conclusion `"failure"`
   - If cancelled: status `"completed"`, conclusion `"cancelled"`

### Real-Time Updates
The PipelineManager component:
- Polls every 10 seconds for pipeline status
- Fetches the latest workflow run for each pipeline
- Detects status/conclusion changes
- Automatically calls `PUT /api/pipelines/:pipelineId/status` to persist
- Updates the UI with current status and icon

## Testing Steps

### 1. Manual Testing via API

#### Get Pipelines
```bash
curl -X GET http://localhost:8999/api/pipelines \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Update Pipeline Status
```bash
curl -X PUT http://localhost:8999/api/pipelines/PIPELINE_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "currentStatus": "in_progress",
    "currentConclusion": null,
    "lastRunId": 12345
  }'
```

### 2. Integration Testing
1. Go to the Pipeline page (`/pipeline`)
2. Trigger a publish workflow
3. Watch the pipeline status update every 10 seconds
4. Status should progress: queued → in_progress → completed (success/failure)
5. The UI should show appropriate status icons:
   - ✓ Green checkmark for success
   - ✗ Red X for failure
   - ⏸️ Gray clock for cancelled/skipped
   - 🔄 Blue clock for in_progress/queued

### 3. Database Verification
Check the `ReleasePipeline` table to verify status is persisted:
```sql
SELECT id, packageName, releaseVersion, currentStatus, currentConclusion, lastRunId, updatedAt
FROM "ReleasePipeline"
ORDER BY "updatedAt" DESC
LIMIT 10;
```

## Status Icon Reference

| Status | Conclusion | Icon | Color |
|--------|-----------|------|-------|
| in_progress | null | 🔄 | Blue |
| queued | null | 🔄 | Blue |
| completed | success | ✓ | Green |
| completed | failure | ✗ | Red |
| completed | cancelled | ⏸️ | Gray |
| completed | skipped | ⏸️ | Gray |

## Key Features

✅ **Automatic Status Tracking**: Pipeline status is automatically updated based on GitHub Actions workflows
✅ **Real-Time UI Updates**: Dashboard refreshes every 10 seconds
✅ **Database Persistence**: Status is saved to the database for historical tracking
✅ **Error Handling**: Gracefully handles network errors and continues polling
✅ **Workflow Linking**: Only fetches runs from the specific pipeline's workflow
✅ **No Manual Intervention**: Status updates happen without user action

## Troubleshooting

### Status Not Updating
1. Check browser console for errors
2. Verify the workflow is running on GitHub
3. Ensure the GitHub API token has admin access
4. Check the API endpoint is responding: `curl http://localhost:8999/api/pipelines`

### Database Not Persisting
1. Verify the migration has run: `npm run db:migrate`
2. Check database connection string in `.env`
3. Look for errors in server logs

### Workflow Not Found
1. Verify the pipeline's `workflowId` is correct
2. Ensure workflow exists in GitHub repo
3. Check GitHub API rate limits aren't exceeded

## Related Endpoints

- `GET /api/pipelines` - Get all pipelines
- `GET /api/pipelines/:pipelineId` - Get specific pipeline
- `GET /api/pipelines/package/:owner/:repo/:packageName` - Get pipelines for a package
- `PUT /api/pipelines/:pipelineId/status` - Update pipeline status (NEW)
- `GET /api/workflows/:owner/:repo` - Get workflow runs for a repo
- `GET /api/workflows/:owner/:repo/runs/:runId` - Get specific run details

## Performance Considerations

- **Polling Frequency**: 10 seconds per pipeline (configurable)
- **API Calls**: For N pipelines, makes ~N+1 API calls per poll cycle
- **Rate Limits**: GitHub API has 5000 requests/hour limit - be mindful with large numbers of pipelines
- **Database**: INSERT/UPDATE operations are minimal, only on status changes

## Future Enhancements

Potential improvements:
- WebSocket support for real-time updates
- Configurable polling intervals
- Batch status updates
- Webhook integration instead of polling
- Status change notifications
- Historical status tracking with timestamps
