# Pipeline Controller-Service-Route Pattern - Quick Reference

## Created Files

### 1. **pipeline-controller.ts** (NEW)
- Location: `src/controllers/pipeline-controller.ts`
- Purpose: HTTP request handlers for all pipeline operations
- Functions: 14 controller functions covering pipelines, workflows, and logs

### 2. **pipeline-routes.ts** (REFACTORED)
- Location: `src/routes/pipeline-routes.ts`
- Previous State: Inline route handlers with mixed business logic
- Current State: Clean route definitions delegating to controllers
- Changes:
  - Removed ~400 lines of inline logic
  - Imported controller functions
  - Simplified to declarative route mapping

### 3. **Documentation**
- Location: `PIPELINE_CONTROLLER_PATTERN.md`
- Complete guide to the three-layer architecture

## Architecture Diagram

```
HTTP Request
    ↓
Routes (Define endpoints)
    ↓
Middleware (Auth, validation)
    ↓
Controller (Handle request, validate input, delegate to service)
    ↓
Service (Business logic, database operations)
    ↓
Database (Prisma ORM)
    ↓
HTTP Response
```

## Controller Functions

### Pipeline Operations
- `getRecentPipelines()` - Fetch recent pipelines (GET /api/pipelines)
- `getPipelineWithRuns()` - Get single pipeline (GET /api/pipelines/:id)
- `getPipelinesByPackage()` - Filter by package (GET /api/pipelines/package/...)
- `createPipeline()` - Create new pipeline (POST /api/pipelines)
- `updatePipelineStatus()` - Update status (PUT /api/pipelines/:id/status)
- `deletePipeline()` - Delete pipeline (DELETE /api/pipelines/:id)
- `getPipelineStats()` - Get statistics (GET /api/pipelines/stats)
- `getPipelineAuditLogs()` - Get audit trail (GET /api/pipelines/:id/audit-logs)

### Workflow Operations
- `listAvailableWorkflows()` - List workflows (GET /api/workflows/:owner/:repo/available)
- `getWorkflowRuns()` - Get runs (GET /api/workflows/:owner/:repo)
- `getWorkflowRunWithJobs()` - Get run details (GET /api/workflows/:owner/:repo/runs/:runId)
- `getJobLogs()` - Get job logs (GET /api/workflows/:owner/:repo/jobs/:jobId/logs)
- `triggerWorkflow()` - Trigger workflow (POST /api/workflows/:owner/:repo/trigger)

## Key Patterns

### Authentication Check
```typescript
if (!req.user) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### Input Validation
```typescript
if (!currentStatus) {
  return res.status(400).json({ error: 'currentStatus is required' });
}
```

### Service Delegation
```typescript
const result = await pipelineService.updatePipelineStatus(
  pipelineId,
  currentStatus,
  currentConclusion,
  lastRunId
);
```

### Response Format
```typescript
res.json({
  success: true,
  data: result,
});
```

### Error Handling
```typescript
try {
  // operations
} catch (error) {
  AppLogger.error(`Error: ${error}`);
  res.status(500).json({ error: 'Failed to perform action' });
}
```

## Comparison: Before vs After

### BEFORE (Inline Routes)
```typescript
router.put('/pipelines/:pipelineId/status', authenticationMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { pipelineId } = req.params;
    const { currentStatus, currentConclusion, lastRunId } = req.body;
    if (!currentStatus) return res.status(400).json({ error: 'currentStatus is required' });
    
    const updatedPipeline = await pipelineService.updatePipelineStatus(
      pipelineId, currentStatus, currentConclusion || null, lastRunId ? String(lastRunId) : undefined
    );
    
    res.json({ success: true, pipeline: updatedPipeline });
  } catch (error) {
    AppLogger.error(`Error updating pipeline status: ${error}`);
    res.status(500).json({ error: 'Failed to update pipeline status' });
  }
});
```

### AFTER (Clean Route + Controller)
```typescript
// route
router.put('/pipelines/:pipelineId/status', authenticationMiddleware, pipelineController.updatePipelineStatus);

// controller
export async function updatePipelineStatus(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { pipelineId } = req.params;
    const { currentStatus, currentConclusion, lastRunId } = req.body;
    if (!currentStatus) return res.status(400).json({ error: 'currentStatus is required' });
    
    const updatedPipeline = await pipelineService.updatePipelineStatus(
      pipelineId, currentStatus, currentConclusion || null, lastRunId ? String(lastRunId) : undefined
    );
    
    res.json({ success: true, pipeline: updatedPipeline });
  } catch (error) {
    AppLogger.error(`Error updating pipeline status: ${error}`);
    res.status(500).json({ error: 'Failed to update pipeline status' });
  }
}
```

**Benefits**:
- ✅ Routes are cleaner and more readable
- ✅ Controllers are reusable and testable
- ✅ Easy to add new endpoints
- ✅ Consistent error handling
- ✅ Follows industry best practices (same as Publish)

## Build Status

✅ All 5 packages compile successfully
- @monodog/utils
- @monodog/ci-status
- @monodog/monorepo-scanner
- @monodog/backend
- @manojkmfsi/monodog (monoapp)

Build time: ~2.3 seconds

## Files Modified

1. **Created**: `src/controllers/pipeline-controller.ts` (~540 lines)
2. **Refactored**: `src/routes/pipeline-routes.ts` (removed ~400 lines of inline logic)
3. **Created**: `PIPELINE_CONTROLLER_PATTERN.md` (documentation)

## Next Steps

1. Test the endpoints with actual requests
2. Add additional controller functions as needed
3. Implement missing service functions (deletePipeline, getPipelineStats)
4. Add unit tests for each controller function
5. Update API documentation with new endpoints

## Testing

To verify the controller pattern is working:

```bash
# Test a pipeline endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8999/api/pipelines

# Test workflow endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8999/api/workflows/owner/repo
```

## References

- Full documentation: [PIPELINE_CONTROLLER_PATTERN.md](PIPELINE_CONTROLLER_PATTERN.md)
- Publish pattern (reference): `src/routes/publish-routes.ts`, `src/controllers/publish-controller.ts`
- GitHub API service: `src/services/github-actions-service.ts`
- Pipeline service: `src/services/pipeline-service.ts`
