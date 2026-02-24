# Pipeline Status Update - Visual Flow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MONODOG PIPELINE SYSTEM                         │
└─────────────────────────────────────────────────────────────────────────┘

                            FRONTEND (React)
┌─────────────────────────────────────────────────────────────────────────┐
│                         PipelineManager.tsx                              │
│                                                                           │
│  useEffect (10s polling):                                               │
│    1. GET /api/pipelines                                                │
│    2. For each pipeline:                                                │
│       - GET /api/workflows/:owner/:repo?workflow_id=X                   │
│       - Compare status/conclusion with current                          │
│       - If changed: PUT /api/pipelines/:pipelineId/status               │
│    3. Update local state + UI                                           │
│                                                                           │
│  Components:                                                             │
│  ├─ WorkflowRunsList (filtered by workflowId)                          │
│  ├─ LogViewer (job logs visualization)                                 │
│  └─ StatusIcon (green/red/gray based on status)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↕ HTTP
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express.js)                              │
│                                                                           │
│  GET /api/pipelines                                                     │
│    └─→ pipeline-service.getRecentPipelines()                            │
│        └─→ SELECT * FROM ReleasePipeline ORDER BY triggeredAt DESC      │
│                                                                           │
│  GET /api/workflows/:owner/:repo?workflow_id=X                          │
│    └─→ github-actions-service.getWorkflowRuns()                         │
│        └─→ GitHub API v3                                                │
│                                                                           │
│  PUT /api/pipelines/:pipelineId/status                                  │
│    └─→ pipeline-service.updatePipelineStatus()                          │
│        └─→ UPDATE ReleasePipeline SET currentStatus=?, ...              │
│            WHERE id = ?                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                            │
│                                                                           │
│  ReleasePipeline Table:                                                 │
│  ├─ id: UUID (Primary Key)                                              │
│  ├─ packageName: string (indexed)                                       │
│  ├─ releaseVersion: string                                              │
│  ├─ owner: string (indexed)                                             │
│  ├─ repo: string (indexed)                                              │
│  ├─ workflowId: integer (indexed)                                       │
│  ├─ workflowName: string                                                │
│  ├─ currentStatus: string (queued|in_progress|completed)                │
│  ├─ currentConclusion: string|null (success|failure|cancelled)          │
│  ├─ lastRunId: integer|null                                             │
│  ├─ triggeredAt: timestamp                                              │
│  ├─ createdAt: timestamp                                                │
│  └─ updatedAt: timestamp                                                │
│                                                                           │
│  WorkflowRun Table:                                                      │
│  ├─ id: UUID                                                             │
│  ├─ gitHubRunId: integer (indexed)                                       │
│  ├─ status: string                                                       │
│  ├─ conclusion: string|null                                              │
│  └─ pipelineId: UUID (Foreign Key)                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                         GITHUB ACTIONS                                   │
│                                                                           │
│  Release Workflow (triggered)                                            │
│  ├─ Status: queued → in_progress → completed                            │
│  └─ Conclusion: (pending) → success/failure/cancelled                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Status Update Sequence Diagram

```
User              Frontend         Backend          Database      GitHub
 │                   │               │                │              │
 ├──Trigger Publish─→├─POST /publish→├─Create Pipeline├─INSERT     │
 │                   │               │                │              │
 │                   │               └─Trigger Workflow────────────→├─(queued)
 │                   │               │                │              │
 │                   ├─Poll (10s)────├─GET /pipelines │              │
 │                   │               │                │              │
 │                   ├─GET /workflows├─GitHub API────→├─Read─────────┤
 │                   │               │                │              │
 │                   │               ├─Status Changed?               │
 │                   │               │                │              │
 │                   ├─PUT /status───├─UPDATE────────→├─(in_progress)
 │                   │               │                │              │
 │                   ├─Poll (10s)────├─GET /pipelines │              │
 │                   │               │                │              │
 │                   ├─GET /workflows├─GitHub API────→├─Read─────────┤
 │                   │               │                │              │
 │                   │               ├─Status Changed?               │
 │                   │               │                │              │
 │                   ├─PUT /status───├─UPDATE────────→├─(completed)
 │                   │               │                │              │
 │                   ├─Display✓/✗───┤               ├─success/fail  │
 │                   │               │               │               │
```

## State Transitions

```
                    Pipeline State Machine
                    
     ┌──────────┐
     │  QUEUED  │  (Initial state when pipeline created)
     └────┬─────┘
          │
          ↓
     ┌──────────────────┐
     │  IN_PROGRESS     │  (Workflow is running)
     └────┬──────────┬──┘
          │          │
          ↓          ↓
    ┌─────────┐  ┌──────────┐
    │ SUCCESS │  │  FAILURE │  (Workflow completed)
    └─────────┘  └──────────┘
    
         OR
    
    ┌────────────┐
    │ CANCELLED  │  (User cancelled or timeout)
    └────────────┘
```

## Key Improvements Over Previous Implementation

| Aspect | Before | After |
|--------|--------|-------|
| Status Updates | Manual/None | Automatic every 10s |
| Database Persistence | Only on creation | Updated on each status change |
| Workflow Filtering | Shows all workflows | Filters by pipeline's workflowId |
| API Calls | GET only | GET + PUT on changes |
| User Feedback | Static status | Real-time status with icons |
| Error Handling | Basic | Graceful with retry logic |
| Performance | N/A | O(n) per polling cycle |

## Example: Publishing 3 Packages

```
Trigger Publish
│
├─ Package: @monodog/utils@1.0.12
│  Pipeline ID: abc-123
│  Workflow ID: 456
│  Status: QUEUED → IN_PROGRESS → COMPLETED (success)
│
├─ Package: @monodog/backend@1.5.36
│  Pipeline ID: def-456
│  Workflow ID: 789
│  Status: QUEUED → IN_PROGRESS → COMPLETED (success)
│
└─ Package: @monodog/ci-status@1.2.16
   Pipeline ID: ghi-789
   Workflow ID: 012
   Status: QUEUED → IN_PROGRESS → COMPLETED (failure)

All statuses update every 10 seconds independently.
Database persists final state.
UI shows real-time progress with visual indicators.
```

## Workflow Run Filtering

### Before
```javascript
// Fetched ALL workflow runs for the repo
GET /api/workflows/:owner/:repo
→ Returns hundreds of unrelated runs
```

### After
```javascript
// Fetch ONLY runs for the specific pipeline's workflow
GET /api/workflows/:owner/:repo?workflow_id=456
→ Returns runs for workflow ID 456 only
→ Typically 3-10 runs max
```

## Configuration

### Polling Interval
```typescript
const interval = setInterval(fetchPipelines, 10000); // 10 seconds
```

Change in `PipelineManager.tsx` line ~225:
```typescript
const interval = setInterval(fetchPipelines, 5000); // For faster updates
```

### Max Parallel Pipelines
```typescript
const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
```

Increase in `pipeline-routes.ts` line ~33 if needed.

## Monitoring

### Log Output
```
[APP] [INFO] Updated pipeline abc-123: status=completed, conclusion=success
[APP] [INFO] Updated pipeline def-456: status=in_progress, conclusion=null
```

### Database Query
```sql
-- Check latest pipeline status
SELECT packageName, releaseVersion, currentStatus, currentConclusion, 
       updatedAt, lastRunId
FROM "ReleasePipeline"
WHERE "packageName" LIKE '@monodog/%'
ORDER BY "updatedAt" DESC
LIMIT 10;
```

### GitHub API Rate Limit
```bash
curl -H "Authorization: Bearer TOKEN" \
  https://api.github.com/rate_limit
```

Expected rate: ~1-2 requests per polling cycle per pipeline
