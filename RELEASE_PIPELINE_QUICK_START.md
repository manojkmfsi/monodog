# Release Pipeline Manager - Quick Start

## What's New?

A complete real-time release pipeline manager has been integrated into MonoDog. You can now:

✅ **Monitor Releases**: View all workflow runs in real-time  
✅ **Trigger Workflows**: Manually start GitHub Actions from MonoDog  
✅ **Stream Logs**: Watch logs with ANSI formatting, step-by-step  
✅ **Manage Runs**: Cancel or re-run workflows without leaving the dashboard  
✅ **Audit Trail**: Track all pipeline actions for compliance  

## Getting Started

### 1. Database Setup

Apply the new Prisma schema:

```bash
# Generate Prisma client
npm run generate

# Run migrations
npm run migrate
```

### 2. Start the Application

```bash
# Terminal 1: Backend
cd packages/monoapp
npm run serve

# Terminal 2: Dashboard
cd packages/monoapp/monodog-dashboard
npm run dev
```

### 3. Access the Pipeline Manager

1. Navigate to MonoDog dashboard (default: http://localhost:5173)
2. Sign in with GitHub
3. Click "Release Pipeline" in the left sidebar
4. View real-time workflow runs and logs

## Features

### Pipeline List

- Shows all release pipelines
- Real-time status updates
- Quick access to workflows
- Trigger button per pipeline

### Workflow Runs

- All runs for a repository
- Status badges (success, failure, running, queued)
- Timestamps and actor info
- Relative time formatting

### Jobs & Steps

- Job-level details
- Step-by-step breakdown
- Individual step status
- Expandable log sections

### Log Viewer

```
┌─────────────────────────────────────────┐
│ ✓ Build & Test                         │
│ 2 steps • GitHub Actions →              │
├─────────────────────────────────────────┤
│ ▼ Setup Node.js                    45s  │
│ 1   14:23:15 npm install                │
│ 2   14:23:20 node --version             │
│ 3   14:23:25 npm list                   │
├─────────────────────────────────────────┤
│ ▼ Build                             12s  │
│ 4   14:23:40 npm run build              │
│ 5   14:23:50 npm run lint               │
├─────────────────────────────────────────┤
│ Showing 1000 of 2543 lines (Show all)   │
└─────────────────────────────────────────┘
```

Features:
- **ANSI Colors**: Full support for terminal colors
- **Line Numbers**: Click-safe line counting
- **Timestamps**: ISO format with hover display
- **Expandable Steps**: Click to show/hide step logs
- **Large Log Support**: Pagination for 10K+ line logs
- **GitHub Link**: Fallback to full logs on GitHub

### Workflow Trigger

Click "Trigger Workflow" to:

```
┌──────────────────────────────┐
│ Trigger Workflow             │
├──────────────────────────────┤
│ Branch: [main        ▼]      │
│                              │
│ Inputs (optional)            │
│ ┌──────────────────────────┐ │
│ │ release_type=patch       │ │
│ │ publish=true             │ │
│ └──────────────────────────┘ │
│                              │
│ [Trigger]  [Cancel]          │
└──────────────────────────────┘
```

### Audit Logging

All actions are logged for compliance:

```typescript
{
  action: 'trigger',
  user: 'john.doe',
  timestamp: '2024-02-11T14:23:15.123Z',
  resourceId: 'run_12345',
  status: 'success'
}
```

## API Endpoints

### List Pipelines

```bash
GET /api/pipelines?limit=20&offset=0
```

Response:
```json
[
  {
    "id": "cuid123",
    "releaseVersion": "1.2.0",
    "packageName": "my-package",
    "owner": "myorg",
    "repo": "myrepo",
    "workflowName": "Release",
    "currentStatus": "in_progress",
    "workflowRuns": [...]
  }
]
```

### Get Workflow Runs

```bash
GET /api/workflows/owner/repo?status=in_progress&page=1
```

Response:
```json
{
  "runs": [
    {
      "id": 12345,
      "name": "Release v1.2.0",
      "status": "in_progress",
      "conclusion": null,
      "createdAt": "2024-02-11T14:20:00Z",
      "htmlUrl": "https://github.com/owner/repo/actions/runs/12345"
    }
  ],
  "totalCount": 5
}
```

### Get Jobs for Run

```bash
GET /api/workflows/owner/repo/runs/12345
```

Response:
```json
{
  "run": {...},
  "jobs": [
    {
      "id": 98765,
      "gitHubJobId": 98765,
      "name": "build",
      "status": "in_progress",
      "conclusion": null
    }
  ],
  "totalCount": 3
}
```

### Stream Job Logs

```bash
GET /api/workflows/owner/repo/jobs/98765/logs
```

Response: Raw log text with ANSI codes preserved

### Trigger Workflow

```bash
POST /api/workflows/owner/repo/trigger
Content-Type: application/json

{
  "workflow": "release.yml",
  "ref": "main",
  "inputs": {
    "release_type": "patch"
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Workflow triggered successfully"
}
```

### Cancel Run

```bash
POST /api/workflows/owner/repo/runs/12345/cancel
```

### Re-run Workflow

```bash
POST /api/workflows/owner/repo/runs/12345/rerun
Content-Type: application/json

{
  "failedOnly": false
}
```

## Configuration

### Repository Settings

Update the pipeline page to use your repository:

```typescript
// src/pages/PipelinePage.tsx
const owner = 'your-org'; // GitHub organization
const repo = 'your-repo';  // Repository name
```

### Polling Intervals

Adjust update frequency in `PipelineManager.tsx`:

```typescript
// Pipeline list: 10 seconds
const interval = setInterval(fetchPipelines, 10000);

// Workflow runs: 5 seconds
const interval = setInterval(fetchJobs, 5000);

// Job logs: 3 seconds (running), longer if completed
const interval = setInterval(fetchLogs, 3000);
```

### Log Pagination

Control displayed lines in `LogViewer.tsx`:

```typescript
// Show first N lines
const linesToShow = step.logs.slice(0, 1000);

// Adjust this number based on performance
```

## Database Schema

### ReleasePipeline

Tracks release information:

```prisma
model ReleasePipeline {
  id              String
  releaseVersion  String
  packageName     String
  owner           String
  repo            String
  workflowId      Int
  workflowName    String
  triggerType     String      // "manual" | "automatic"
  triggeredBy     String      // username
  triggeredAt     DateTime
  currentStatus   String      // "queued" | "in_progress" | "completed"
  currentConclusion String?   // "success" | "failure" | null
  lastRunId       Int?
  
  workflowRuns    WorkflowRun[]
  auditLogs       PipelineAuditLog[]
}
```

### Related Models

- `WorkflowRun` - GitHub Actions workflow run
- `WorkflowJob` - Job within a run
- `WorkflowStep` - Step within a job
- `JobLog` - Cached logs with pagination
- `PipelineAuditLog` - Audit trail

## Common Tasks

### View Logs for a Specific Job

1. Select pipeline from list
2. Select workflow run
3. Click job name
4. Logs auto-load below

### Trigger a New Workflow

1. Select pipeline
2. Click "Trigger Workflow" button
3. Enter branch (default: main)
4. Add optional inputs (one per line: `key=value`)
5. Click "Trigger"

### Check Rate Limits

```bash
curl http://localhost:8999/api/rate-limit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Audit Trail

```bash
curl http://localhost:8999/api/pipelines/{pipelineId}/audit-logs
```

## Troubleshooting

### Logs Not Showing

1. Check if job has completed
2. Verify GitHub Actions workflow exists
3. Check GitHub token has `actions:read` permission
4. Review browser DevTools Network tab

### Workflows Not Triggering

1. Verify token has `workflow:write` permission
2. Check branch name is correct
3. Ensure workflow file exists in repository
4. Review error message in modal

### Database Errors

```bash
# Reset migrations (development only)
npm run migrate:reset

# Reapply migrations
npm run migrate
```

### Performance Issues

1. Reduce polling frequency
2. Limit displayed runs with query parameters
3. Clear browser cache
4. Check network bandwidth

## Next Steps

### 1. Customize Repository

Update `PipelinePage.tsx` with your repository:

```typescript
const owner = 'manojkmfsi';
const repo = 'monodog';
```

### 2. Configure Workflows

Ensure GitHub Actions workflows exist and are properly configured:

- File: `.github/workflows/release.yml`
- Trigger: `workflow_dispatch` for manual triggers
- Inputs: Optional for parameterized runs

### 3. Set Up Permissions

Repository access required:
- `contents: read` - View repository content
- `actions: read` - View workflow runs
- `workflow: write` - Trigger workflows (if needed)

### 4. Monitor Production

- Review audit logs regularly
- Set up alerts for failed workflows
- Monitor GitHub API rate limits
- Track release cadence and duration

## Support

For issues or questions:

1. Check the [Release Pipeline Implementation Guide](./RELEASE_PIPELINE_IMPLEMENTATION.md)
2. Review GitHub Actions API docs: https://docs.github.com/en/rest/actions
3. Check MonoDog documentation
4. File an issue in the repository

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    MonoDog Dashboard                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Pipeline Manager Component              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │Pipelines │ │Runs      │ │Jobs & Log Viewer │ │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│                      Backend API                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Pipeline Routes & GitHub Actions Service        │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
          ↓                                   ↓
    ┌──────────────┐              ┌─────────────────┐
    │  SQLite DB   │              │ GitHub API      │
    │ (Pipelines)  │              │ (Workflows)     │
    └──────────────┘              └─────────────────┘
```

---

**Last Updated**: February 2024  
**Version**: 1.0  
**Status**: Production Ready
