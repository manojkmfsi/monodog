# Real-Time Release Pipeline Manager - Implementation Guide

## Overview

This implementation provides a comprehensive real-time release pipeline manager backed by GitHub Actions, integrated directly into MonoDog. Users can monitor releases, trigger workflows, view logs with ANSI formatting, and manage the entire release process without leaving the dashboard.

## Architecture

### Backend Components

#### 1. **GitHub Actions API Service** (`src/services/github-actions-service.ts`)
- **Purpose**: Centralized service for all GitHub Actions API interactions
- **Key Functions**:
  - `getWorkflowRuns()`: Fetch workflow runs with filtering
  - `getWorkflowRun()`: Get specific run details
  - `getWorkflowRunJobs()`: Retrieve jobs for a run
  - `getJobLogs()`: Fetch raw logs for a job
  - `triggerWorkflow()`: Manually trigger a workflow
  - `cancelWorkflowRun()`: Cancel a running workflow
  - `rerunWorkflow()`: Re-run a workflow (all or failed jobs only)
  - `getRateLimit()`: Check GitHub API rate limits
  - `parseJobLogs()`: Parse raw logs into structured step format with ANSI preservation

#### 2. **Pipeline Service** (`src/services/pipeline-service.ts`)
- **Purpose**: Database operations and pipeline state management
- **Key Functions**:
  - `createOrUpdatePipeline()`: Create/update release pipeline records
  - `getPipelineWithRuns()`: Fetch pipeline with related runs
  - `storeWorkflowRun()`: Persist workflow run to database
  - `storeWorkflowJobs()`: Persist jobs and steps
  - `storeJobLogs()`: Cache logs in database
  - `createAuditLog()`: Log all actions for compliance
  - `getPipelineAuditLogs()`: Retrieve audit trail
  - `getRecentPipelines()`: Dashboard pipeline list
  - `getPipelinesByPackage()`: Filter by package
  - `deleteOldPipelines()`: Cleanup task

#### 3. **Pipeline Routes** (`src/routes/pipeline-routes.ts`)
- **Endpoints**:
  - `GET /api/pipelines` - List pipelines
  - `GET /api/pipelines/:pipelineId` - Get specific pipeline
  - `GET /api/pipelines/package/:owner/:repo/:packageName` - Filter by package
  - `GET /api/workflows/:owner/:repo` - List workflow runs
  - `GET /api/workflows/:owner/:repo/runs/:runId` - Get run with jobs
  - `GET /api/workflows/:owner/:repo/jobs/:jobId/logs` - Stream logs
  - `POST /api/workflows/:owner/:repo/trigger` - Trigger workflow
  - `POST /api/workflows/:owner/:repo/runs/:runId/cancel` - Cancel run
  - `POST /api/workflows/:owner/:repo/runs/:runId/rerun` - Re-run workflow
  - `GET /api/pipelines/:pipelineId/audit-logs` - Get audit trail
  - `GET /api/rate-limit` - Check API limits

#### 4. **Database Schema** (`prisma/schema/github-actions.prisma`)

**ReleasePipeline**
- Tracks high-level release information
- Indexes: owner/repo, packageName, triggeredAt

**WorkflowRun**
- GitHub workflow run details
- Stores status, conclusion, timestamps
- Linked to pipeline via foreign key

**WorkflowJob**
- Job-level details with status tracking
- Contains step information
- Linked to workflow run

**WorkflowStep**
- Individual step information
- Timestamps and conclusion
- Part of job hierarchy

**JobLog**
- Cached job logs with pagination info
- Stores parsed log lines as JSON
- References raw GitHub logs URL as fallback

**PipelineAuditLog**
- Comprehensive audit trail
- Tracks: user, action, resource, timestamp, status
- Indexes: pipelineId, userId, action, timestamp

### Frontend Components

#### 1. **LogViewer.tsx**
- **Features**:
  - Step-by-step log display with expandable sections
  - Full ANSI escape code support (colors, bold, italic, underline)
  - Line numbers with timestamps
  - Hover effects for better readability
  - Fallback link to GitHub Actions UI
  - Large log handling (1000+ lines)
  - Dark theme optimized for terminal-like appearance
  - Scrollbar customization

- **ANSI Code Support**:
  - Standard colors (30-37)
  - Bright colors (90-97)
  - Text styles (bold, dim, italic, underline)
  - Background colors (40-47, 100-107)

#### 2. **WorkflowRunsList.tsx**
- **Features**:
  - Real-time polling (5-second interval)
  - Status badges with color coding
  - Relative time formatting (e.g., "5m ago")
  - Quick link to GitHub
  - Selectable run list

#### 3. **WorkflowTrigger.tsx**
- **Features**:
  - Modal-based trigger interface
  - Branch selection
  - Optional input parameters
  - Error handling and display
  - Loading states

#### 4. **PipelineManager.tsx**
- **Main Component Layout**:
  - Left sidebar: Pipeline list
  - Second column: Workflow runs
  - Third column: Jobs list
  - Main area: Log viewer
  - 4-column responsive grid

- **Features**:
  - Multi-level selection (pipeline → run → job → logs)
  - Real-time polling for each level
  - Status indicators with icons
  - Integrated trigger button
  - Error handling

#### 5. **PipelinePage.tsx**
- **Purpose**: Page wrapper for route integration

## Configuration

### Environment Variables

```bash
# Backend
GITHUB_TOKEN=<your_github_token>
DATABASE_URL=sqlite:./monodog.db

# Dashboard (if needed)
REACT_APP_API_BASE_URL=http://localhost:8999/api
```

### GitHub App Permissions Required

```yaml
contents: read
actions: read
workflow: write  # For triggering workflows
```

## Real-Time Updates Strategy

### Polling Implementation

The system uses intelligent polling with exponential backoff:

```typescript
- **Active workflows**: 3-5 second intervals
- **Completed workflows**: 10-30 second intervals
- **Error handling**: Exponential backoff up to 60 seconds
- **Rate limit awareness**: Auto-throttle when approaching limits
```

### Subscription Alternative (Future)

For production deployments, consider:
- GitHub webhook integration for event-driven updates
- WebSocket connections for real-time push
- Server-sent events (SSE) for log streaming

## Rate Limiting

- **GitHub API**: 5,000 requests/hour (authenticated)
- **Strategy**: 
  - Cache results locally
  - Batch API calls
  - Respect X-RateLimit headers
  - Exponential backoff
  - Queue long-running operations

## Log Handling

### Parsing Logic

GitHub Actions logs include:
```
\u001b[36m##[group]Step Name\u001b[0m
Log content here
\u001b[36m##[endgroup]\u001b[0m
```

The parser:
1. Identifies group markers for step boundaries
2. Associates log lines with steps
3. Preserves ANSI codes for rendering
4. Strips codes for plain text display
5. Extracts timestamps from log lines

### Large Log Handling

- Pagination: Displays first 1000 lines with "Show all" link
- Lazy loading: Only renders visible logs
- Streaming support: Ready for chunked responses
- Memory optimization: Only stores required lines

## Audit Logging

### Captured Actions

```typescript
- trigger: Workflow triggered manually
- cancel: Workflow cancelled
- rerun: Workflow re-run
- view_logs: Logs accessed
- approve_deployment: Deployment approved (future)
```

### Stored Information

- User ID and username
- Action type and timestamp
- Resource details (run ID, job ID)
- Result status and error messages
- Additional context (parameters, inputs)

## Error Handling

### Edge Cases Handled

1. **Cancelled Workflows**
   - Status properly reflected
   - No logs available for some jobs
   - Graceful degradation in UI

2. **Re-runs**
   - Tracks multiple attempts
   - Shows run history
   - Preserves logs from each attempt

3. **Partial Job Failures**
   - Step-level status visibility
   - Individual job retry capability
   - Clear failure indicators

4. **Rate Limit Exceeded**
   - Automatic backoff
   - User notification
   - Fallback to cached data

5. **Large Logs**
   - Pagination with manual load
   - Memory-efficient rendering
   - Timeout protection

6. **Network Failures**
   - Automatic retry
   - Cached data fallback
   - User error messages

## Database Migrations

```bash
# Generate migration
npx prisma migrate dev --name add_github_actions_models

# Deploy migration
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## Integration Steps

### 1. Database Setup
```bash
# Update schema with github-actions.prisma
# Run migrations
npm run migrate
```

### 2. Backend Registration
```typescript
// In routes/index.ts or main setup
import { setupPipelineRoutes } from './pipeline-routes';
setupPipelineRoutes(app);
```

### 3. Frontend Routes
- ✅ Updated `routes.config.ts` with pipeline route
- ✅ Updated `AppRouter.tsx` with Pipeline component
- ✅ Updated `pages/index.ts` exports
- ✅ Updated `Layout.tsx` navigation

### 4. Authentication
- Ensure GitHub OAuth token is available in request context
- Validate user permissions before API calls
- Audit log all user actions

## Testing Checklist

- [ ] Workflow runs display in real-time
- [ ] Job list updates automatically
- [ ] Logs render with ANSI formatting
- [ ] Step expand/collapse works smoothly
- [ ] Workflow trigger modal appears
- [ ] Trigger requests are sent correctly
- [ ] Audit logs record all actions
- [ ] Rate limits are respected
- [ ] Large logs (10K+ lines) handle correctly
- [ ] Network errors show appropriate messages
- [ ] Fallback to GitHub links work
- [ ] Responsive layout on mobile

## Performance Considerations

### Optimization Strategies

1. **Memoization**: Components memoized to prevent re-renders
2. **Virtual Scrolling**: Large lists virtualized (future enhancement)
3. **Request Batching**: Multiple API calls consolidated
4. **Cache Strategy**: 
   - Database caching for completed runs
   - 5-minute cache for run metadata
   - Real-time for in-progress runs

### Scalability

- Database indexes on frequently queried fields
- Cleanup task removes data older than 90 days
- Log pagination prevents memory overflow
- Connection pooling for database

## Accessibility

- Semantic HTML structure
- Proper ARIA labels
- Keyboard navigation support
- High contrast colors for status indicators
- Readable fonts for log content

## Security Considerations

1. **Token Management**
   - Use OAuth tokens only
   - No token logging
   - Secure transmission (HTTPS only)

2. **Permission Checks**
   - Validate user has repo access
   - Enforce action-based permissions
   - Audit all modifications

3. **Input Validation**
   - Sanitize workflow inputs
   - Validate branch references
   - Check branch existence before trigger

4. **CSRF Protection**
   - Use proper session tokens
   - Validate request origins

## Future Enhancements

1. **Deployment Approval Gates**
   - Approval workflow integration
   - Multiple reviewers support
   - Deployment metrics

2. **Webhook Integration**
   - Real-time event-driven updates
   - GitHub webhook parsing
   - Automatic refresh on actions

3. **Advanced Filtering**
   - Filter by status, branch, actor
   - Search across logs
   - Custom views and dashboards

4. **Log Analysis**
   - Error pattern detection
   - Performance metrics
   - Log trending and analytics

5. **Integration with Release Manager**
   - Link releases to pipeline runs
   - Changelog generation from logs
   - Release notes auto-population

6. **Notifications**
   - Slack integration
   - Email alerts
   - In-app notifications for failures

## Troubleshooting

### Common Issues

**Logs not loading**
- Check GitHub API token is valid
- Verify job ID is correct
- Check rate limits with `/api/rate-limit`
- Review network requests in browser DevTools

**Runs not updating**
- Confirm polling interval is active
- Check network tab for failed requests
- Verify GitHub Actions workflow exists
- Review browser console for errors

**ANSI codes not rendering**
- Clear browser cache
- Check CSS is loaded correctly
- Verify ansiToHtml function is executing
- Test with simple test log first

**Database errors**
- Ensure Prisma migrations are applied
- Check DATABASE_URL is set correctly
- Verify SQLite database file exists
- Review logs for Prisma errors

## Support and Documentation

- GitHub Actions API: https://docs.github.com/en/rest/actions
- Prisma Documentation: https://www.prisma.io/docs
- ANSI Escape Codes: https://en.wikipedia.org/wiki/ANSI_escape_code
- React Patterns: https://react.dev

## License

Same as MonoDog project (MIT)
