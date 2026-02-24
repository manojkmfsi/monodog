# Pipeline Controller-Service-Route Pattern

This document describes the MVC (Model-View-Controller) pattern implementation for the Pipeline feature in MonoDog, following the same architecture as the Publish feature.

## Architecture Overview

The pipeline module follows a **three-layer architecture**:

```
Routes (pipeline-routes.ts)
   ↓
Controllers (pipeline-controller.ts)
   ↓
Services (pipeline-service.ts, github-actions-service.ts)
   ↓
Database (Prisma ORM)
```

## File Structure

```
src/
├── routes/
│   └── pipeline-routes.ts          # HTTP route definitions
├── controllers/
│   └── pipeline-controller.ts      # Request handlers
├── services/
│   ├── pipeline-service.ts         # Pipeline business logic
│   └── github-actions-service.ts   # GitHub API integration
└── middleware/
    └── auth-middleware.ts          # Authentication/authorization
```

## Layer Responsibilities

### 1. Routes Layer (`pipeline-routes.ts`)

**Responsibility**: Define HTTP endpoints and apply middleware

**Key Features**:
- Maps HTTP verbs (GET, POST, PUT, DELETE) to controller functions
- Applies authentication/authorization middleware
- Passes request/response objects to controllers
- Clean, declarative endpoint definitions

**Example**:
```typescript
router.get('/pipelines', authenticationMiddleware, pipelineController.getRecentPipelines);

router.put(
  '/pipelines/:pipelineId/status',
  authenticationMiddleware,
  pipelineController.updatePipelineStatus
);

router.post(
  '/workflows/:owner/:repo/trigger',
  authenticationMiddleware,
  pipelineController.triggerWorkflow
);
```

**Benefits**:
- Routes are easy to read and understand
- Middleware is applied consistently
- No business logic cluttering the routes

### 2. Controller Layer (`pipeline-controller.ts`)

**Responsibility**: Handle HTTP requests and responses

**Key Features**:
- Validate incoming request data
- Extract parameters from req (params, query, body)
- Call service layer for business logic
- Format and send responses (JSON)
- Handle authentication checks (`if (!req.user)`)
- Logging for debugging

**Example**:
```typescript
export async function updatePipelineStatus(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pipelineId } = req.params;
    const { currentStatus, currentConclusion, lastRunId } = req.body;

    if (!currentStatus) {
      return res.status(400).json({ error: 'currentStatus is required' });
    }

    const updatedPipeline = await pipelineService.updatePipelineStatus(
      pipelineId,
      currentStatus,
      currentConclusion || null,
      lastRunId ? String(lastRunId) : undefined
    );

    res.json({
      success: true,
      pipeline: updatedPipeline,
    });
  } catch (error) {
    AppLogger.error(`Error updating pipeline status: ${error}`);
    res.status(500).json({ error: 'Failed to update pipeline status' });
  }
}
```

**Responsibilities**:
- **Input Validation**: Check required fields
- **Authorization**: Verify user has permission (via middleware)
- **Service Delegation**: Call service layer for business logic
- **Response Formatting**: Send proper HTTP status codes and JSON
- **Error Handling**: Catch exceptions and return error responses

**Benefits**:
- Separation from HTTP framework details
- Easy to test (can mock services)
- Consistent error handling
- Business logic is isolated in services

### 3. Service Layer (`pipeline-service.ts`, `github-actions-service.ts`)

**Responsibility**: Implement business logic and data access

**Pipeline Service** (`pipeline-service.ts`):
- Create/update pipelines in database
- Fetch pipeline data
- Manage audit logs
- Pipeline status tracking

```typescript
export async function updatePipelineStatus(
  pipelineId: string,
  currentStatus: string,
  currentConclusion: string | null,
  lastRunId?: string
): Promise<any> {
  try {
    const result = await prisma.releasePipeline.update({
      where: { id: pipelineId },
      data: {
        currentStatus,
        currentConclusion,
        ...(lastRunId && { lastRunId: String(lastRunId) }),
        updatedAt: new Date(),
      },
    });

    AppLogger.info(
      `Updated pipeline ${pipelineId}: status=${currentStatus}, conclusion=${currentConclusion}`
    );

    return result;
  } catch (error) {
    AppLogger.error(`Failed to update pipeline status: ${error}`);
    throw error;
  }
}
```

**GitHub Actions Service** (`github-actions-service.ts`):
- Fetch workflow runs from GitHub API
- Get job details and logs
- Trigger workflows
- Handle GitHub API rate limiting

```typescript
export async function getWorkflowRuns(
  owner: string,
  repo: string,
  accessToken: string,
  options?: { /* ... */ }
): Promise<{
  runs: WorkflowRun[];
  totalCount: number;
  rateLimit: RateLimitInfo;
}> {
  // ... GitHub API integration
}
```

**Benefits**:
- Pure business logic, no HTTP concerns
- Reusable across different interfaces (API, CLI, etc.)
- Easy to test in isolation
- Clear data flow

## API Endpoints

### Pipeline Endpoints

| Method | Endpoint | Controller Function | Purpose |
|--------|----------|-------------------|---------|
| GET | `/api/pipelines` | `getRecentPipelines` | Get recent pipelines |
| GET | `/api/pipelines/:pipelineId` | `getPipelineWithRuns` | Get specific pipeline |
| GET | `/api/pipelines/package/:owner/:repo/:packageName` | `getPipelinesByPackage` | Get pipelines for package |
| POST | `/api/pipelines` | `createPipeline` | Create new pipeline |
| PUT | `/api/pipelines/:pipelineId/status` | `updatePipelineStatus` | Update pipeline status |
| DELETE | `/api/pipelines/:pipelineId` | `deletePipeline` | Delete pipeline |
| GET | `/api/pipelines/stats` | `getPipelineStats` | Get statistics |
| GET | `/api/pipelines/:pipelineId/audit-logs` | `getPipelineAuditLogs` | Get audit trail |

### Workflow Endpoints

| Method | Endpoint | Controller Function | Purpose |
|--------|----------|-------------------|---------|
| GET | `/api/workflows/:owner/:repo/available` | `listAvailableWorkflows` | List workflows |
| GET | `/api/workflows/:owner/:repo` | `getWorkflowRuns` | Get workflow runs |
| GET | `/api/workflows/:owner/:repo/runs/:runId` | `getWorkflowRunWithJobs` | Get run with jobs |
| GET | `/api/workflows/:owner/:repo/jobs/:jobId/logs` | `getJobLogs` | Get job logs |
| POST | `/api/workflows/:owner/:repo/trigger` | `triggerWorkflow` | Trigger workflow |

## Data Flow Example

### Update Pipeline Status

```
1. Frontend (React)
   └─> PUT /api/pipelines/{id}/status
       {
         "currentStatus": "completed",
         "currentConclusion": "success",
         "lastRunId": "123456"
       }

2. Routes Layer (pipeline-routes.ts)
   └─> router.put('/pipelines/:pipelineId/status', ...)

3. Middleware
   └─> authenticationMiddleware (validates user)

4. Controller (pipeline-controller.ts)
   └─> updatePipelineStatus(req, res)
       - Extract pipelineId from params
       - Extract body data
       - Validate required fields
       - Call service layer

5. Service (pipeline-service.ts)
   └─> updatePipelineStatus(pipelineId, status, conclusion, lastRunId)
       - Update Prisma database
       - Log audit entry
       - Return updated pipeline

6. Controller (continued)
   └─> Format response
       res.json({ success: true, pipeline: updatedPipeline })

7. Frontend
   └─> Receive response and update UI
```

## Error Handling Pattern

The application uses a consistent error handling pattern:

```typescript
try {
  // Validate authentication
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate input
  if (!currentStatus) {
    return res.status(400).json({ error: 'currentStatus is required' });
  }

  // Call service
  const result = await pipelineService.updatePipelineStatus(...);

  // Send response
  res.json({ success: true, data: result });
} catch (error) {
  // Log error
  AppLogger.error(`Error: ${error}`);
  
  // Send error response
  res.status(500).json({ error: 'Failed to update pipeline status' });
}
```

**Status Codes Used**:
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Adding New Features

To add a new pipeline feature:

1. **Add Route** in `pipeline-routes.ts`:
```typescript
router.post('/pipelines/action', authenticationMiddleware, pipelineController.newAction);
```

2. **Add Controller** in `pipeline-controller.ts`:
```typescript
export async function newAction(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    const result = await pipelineService.newActionLogic(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    AppLogger.error(`Error: ${error}`);
    res.status(500).json({ error: 'Failed to perform action' });
  }
}
```

3. **Add Service** in `pipeline-service.ts`:
```typescript
export async function newActionLogic(params: any): Promise<any> {
  try {
    // Business logic here
    const result = await prisma.releasePipeline.update(...);
    return result;
  } catch (error) {
    AppLogger.error(`Failed: ${error}`);
    throw error;
  }
}
```

## Testing

With this architecture, each layer can be tested independently:

```typescript
// Test Service (no HTTP)
const result = await pipelineService.updatePipelineStatus(
  'pipeline-1',
  'completed',
  'success'
);
expect(result.currentStatus).toBe('completed');

// Test Controller (mock service)
const mockService = jest.spyOn(pipelineService, 'updatePipelineStatus');
await updatePipelineStatus(req, res);
expect(mockService).toHaveBeenCalled();

// Test Routes (full integration)
const response = await request(app)
  .put('/api/pipelines/123/status')
  .send({ currentStatus: 'completed' });
expect(response.status).toBe(200);
```

## Benefits of This Pattern

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Reusability**: Services can be used by multiple controllers or interfaces
3. **Testability**: Layers can be tested in isolation
4. **Maintainability**: Easy to understand and modify code
5. **Scalability**: Easy to add new endpoints without changing existing code
6. **Consistency**: All endpoints follow the same pattern
7. **Error Handling**: Centralized, consistent error handling

## Related Files

- Publish pattern (similar architecture): `src/routes/publish-routes.ts`, `src/controllers/publish-controller.ts`
- Authentication: `src/middleware/auth-middleware.ts`
- GitHub integration: `src/services/github-actions-service.ts`
- Database schema: `prisma/schema.prisma`
- Types: `src/types/github-actions.ts`
