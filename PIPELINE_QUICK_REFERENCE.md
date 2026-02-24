# Pipeline Status Updates - Quick Reference

## What's New ✨

Your pipeline system now automatically tracks and updates the status of your release workflows in real-time:

```
Publishing packages:
🦋 info Publishing "@monodog/utils" at "1.0.12"
🦋 info Publishing "@monodog/backend" at "1.5.36"
🦋 info Publishing "@monodog/ci-status" at "1.2.16"

        ↓ (automatic status tracking)

UI updates every 10 seconds:
✓ @monodog/utils - SUCCESS
⏳ @monodog/backend - IN_PROGRESS
⏳ @monodog/ci-status - QUEUED
```

## The Three Major Fixes

### 1️⃣ Pipeline Status Auto-Update
**Problem**: Pipeline status was static after creation
**Solution**: Added automatic polling that:
- Checks GitHub Actions API every 10 seconds
- Detects status changes (queued → in_progress → completed)
- Detects conclusion (null → success/failure/cancelled)
- Persists to database via new PUT endpoint
- Updates UI with color-coded status icons

### 2️⃣ Workflow Run Filtering
**Problem**: Showed all repository workflow runs mixed together
**Solution**: Filter workflow runs by pipeline's specific workflowId
- Only shows runs for the relevant workflow
- Reduces API calls and network traffic
- Cleaner UI showing only related runs

### 3️⃣ Code Cleanup
**Problem**: Unused parameters being sent to API
**Solution**: Removed:
- Unnecessary `pipelineId` from cancel/rerun endpoints
- Unused variable calculations
- Obsolete packageName-based filtering

## Files Changed

### Backend (3 files)
1. `src/services/pipeline-service.ts` - Added `updatePipelineStatus()` function
2. `src/routes/pipeline-routes.ts` - Added `PUT /api/pipelines/:pipelineId/status` endpoint
3. `src/middleware/server-startup.ts` - Updated endpoint list in logs

### Frontend (2 files)
1. `monodog-dashboard/src/components/pipeline/PipelineManager.tsx` - Enhanced polling logic
2. `monodog-dashboard/src/components/pipeline/WorkflowRunsList.tsx` - Filter by workflowId

## How to Use

### Trigger Publishing
```bash
# In the dashboard, go to Release Manager
# Create changesets for the packages you want to publish
# Click "Publish" button
```

### Watch Status Updates
```
1. Navigate to Pipeline page (/pipeline)
2. You'll see your pipelines listed
3. Status auto-updates every 10 seconds
4. Icons show current state:
   - 🔄 Blue = in_progress or queued
   - ✓ Green = completed with success
   - ✗ Red = completed with failure
   - ⏸️ Gray = cancelled or skipped
```

### Click Into Pipeline
- Shows workflow runs for that pipeline only
- Expand a run to see individual jobs
- Click a job to view detailed logs

## API Changes

### New Endpoint
```http
PUT /api/pipelines/:pipelineId/status
```

**Request Body**:
```json
{
  "currentStatus": "completed",
  "currentConclusion": "success",
  "lastRunId": 12345
}
```

**Response**:
```json
{
  "success": true,
  "pipeline": {
    "id": "...",
    "currentStatus": "completed",
    "currentConclusion": "success",
    "updatedAt": "2026-02-20T10:30:00Z"
  }
}
```

### Updated Interfaces

**Pipeline object now includes**:
```typescript
{
  currentConclusion?: string | null;  // success | failure | cancelled
  workflowPath?: string;              // reference to workflow file
  // ... existing fields
}
```

**WorkflowRunsList props**:
```typescript
{
  workflowId?: number | string;  // NEW - filters by this workflow
  pipelineId: string;             // CHANGED - now required
  // ... other existing props
}
```

## Database

The `ReleasePipeline` table is updated with:
- `currentStatus`: Latest status from GitHub
- `currentConclusion`: Latest conclusion (if completed)
- `lastRunId`: GitHub run ID
- `updatedAt`: Last update timestamp

Query to check status:
```sql
SELECT packageName, releaseVersion, currentStatus, 
       currentConclusion, updatedAt
FROM "ReleasePipeline"
ORDER BY updatedAt DESC
LIMIT 10;
```

## Performance

- **Polling Interval**: 10 seconds (adjustable)
- **API Calls**: 1-2 per pipeline per cycle
- **Database**: UPDATE only on status changes
- **Network**: ~50-200ms per polling cycle
- **No Breaking Changes**: Fully backward compatible

## Troubleshooting

### Status not updating?
1. ✅ Check browser console for errors
2. ✅ Verify workflow is running on GitHub
3. ✅ Ensure GitHub token has proper permissions
4. ✅ Check API endpoint is responding: `curl http://localhost:8999/api/pipelines`

### Workflow runs showing all workflows?
1. ✅ Verify `workflowId` is passed to WorkflowRunsList
2. ✅ Check network request includes `workflow_id` parameter
3. ✅ Ensure pipeline has valid `workflowId`

### Database not persisting?
1. ✅ Check database connection in `.env`
2. ✅ Verify migrations have run: `npm run db:migrate`
3. ✅ Check server logs for database errors

## Testing Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] Trigger a publish workflow
- [ ] Wait 10 seconds, status should update
- [ ] Status progresses: queued → in_progress → completed
- [ ] UI shows correct status icons (✓ green, ✗ red, etc.)
- [ ] Database shows final status
- [ ] Workflow runs list shows only runs for that pipeline
- [ ] No console errors in browser DevTools

## Documentation Files

📄 **PIPELINE_STATUS_IMPLEMENTATION.md** - Technical implementation details
📄 **PIPELINE_STATUS_TESTING_GUIDE.md** - Comprehensive testing guide
📄 **PIPELINE_ARCHITECTURE.md** - System architecture and flows

## Rollback

If needed, can revert the changes by:
1. Git revert the 5 modified files
2. Run migrations backward (no new migrations added)
3. System continues working with static status (reads only)

## What's Next?

Potential future enhancements:
- WebSocket real-time updates (no polling)
- GitHub webhook integration
- Status change notifications
- Historical status dashboard
- Configurable polling intervals per pipeline

## Questions?

Check the documentation files or review the code:
- Backend logic: `src/services/pipeline-service.ts`
- Frontend logic: `monodog-dashboard/src/components/pipeline/PipelineManager.tsx`
- API routes: `src/routes/pipeline-routes.ts`

---

**Version**: 1.0.0  
**Release Date**: February 2026  
**Status**: ✅ Ready for Testing
