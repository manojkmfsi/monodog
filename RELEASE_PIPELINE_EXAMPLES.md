# Release Pipeline Manager - Code Examples & Snippets

Quick reference for common code patterns and usage examples.

## 🔧 Backend Usage Examples

### Using the GitHub Actions Service

```typescript
import * as githubActionsService from './services/github-actions-service';

// Get workflow runs
const { runs, totalCount, rateLimit } = 
  await githubActionsService.getWorkflowRuns(
    'owner',
    'repo',
    accessToken,
    { status: 'in_progress', page: 1, per_page: 30 }
  );

// Get a specific run with all details
const { run, rateLimit } = 
  await githubActionsService.getWorkflowRun(
    'owner',
    'repo',
    12345,
    accessToken
  );

// Get jobs for a run
const { jobs, totalCount, rateLimit } = 
  await githubActionsService.getWorkflowRunJobs(
    'owner',
    'repo',
    12345,
    accessToken,
    1, // page
    30 // per_page
  );

// Stream job logs
const { logs, rateLimit } = 
  await githubActionsService.getJobLogs(
    'owner',
    'repo',
    98765,
    accessToken
  );

// Trigger a workflow
const { response, rateLimit } = 
  await githubActionsService.triggerWorkflow(
    accessToken,
    {
      owner: 'owner',
      repo: 'repo',
      workflow: 'release.yml',
      ref: 'main',
      inputs: {
        version: '1.2.0',
        publish: 'true'
      }
    }
  );

// Cancel a workflow run
const { success, rateLimit } = 
  await githubActionsService.cancelWorkflowRun(
    'owner',
    'repo',
    12345,
    accessToken
  );

// Re-run a workflow
const { success, rateLimit } = 
  await githubActionsService.rerunWorkflow(
    'owner',
    'repo',
    12345,
    accessToken,
    false // failedOnly
  );

// Check rate limits
const rateLimit = 
  await githubActionsService.getRateLimit(accessToken);
```

### Using the Pipeline Service

```typescript
import * as pipelineService from './services/pipeline-service';

// Create or update a pipeline
const { id } = await pipelineService.createOrUpdatePipeline({
  releaseVersion: '1.2.0',
  packageName: 'my-package',
  owner: 'owner',
  repo: 'repo',
  workflowId: 123,
  workflowName: 'Release',
  triggerType: 'manual',
  triggeredBy: 'john.doe',
  triggeredAt: new Date(),
  currentStatus: 'in_progress',
  currentConclusion: null,
  lastRunId: 12345
});

// Get pipeline with runs
const pipeline = await pipelineService.getPipelineWithRuns(pipelineId);
// Returns: {
//   id, releaseVersion, packageName, owner, repo, workflowName,
//   currentStatus, lastRunId,
//   workflowRuns: [...]
// }

// Store workflow run in database
const runId = await pipelineService.storeWorkflowRun(pipelineId, githubRun);

// Store jobs and steps
const jobIds = await pipelineService.storeWorkflowJobs(
  workflowRunId,
  githubJobs
);

// Store logs
await pipelineService.storeJobLogs(jobId, parsedLogs, rawLogUrl);

// Create audit log
await pipelineService.createAuditLog(
  pipelineId,
  userId,
  username,
  'trigger',
  'workflow_run',
  'run_123',
  'Trigger Release Workflow',
  { version: '1.2.0', branch: 'main' },
  'success'
);

// Get audit logs
const logs = await pipelineService.getPipelineAuditLogs(pipelineId, 50, 0);

// Get recent pipelines
const pipelines = await pipelineService.getRecentPipelines(20, 0);

// Get pipelines by package
const pipelines = await pipelineService.getPipelinesByPackage(
  'my-package',
  'owner',
  'repo',
  20
);

// Clean up old pipelines
const deletedCount = await pipelineService.deleteOldPipelines(90); // days old
```

## ⚛️ Frontend Usage Examples

### Using LogViewer Component

```typescript
import LogViewer from './components/pipeline/LogViewer';

// In your component:
<LogViewer
  steps={[
    {
      stepNumber: 1,
      stepName: 'Install Dependencies',
      startedAt: '2024-02-11T14:23:15Z',
      completedAt: '2024-02-11T14:23:45Z',
      conclusion: 'success',
      status: 'completed',
      logs: [
        {
          lineNumber: 1,
          timestamp: '2024-02-11T14:23:15.123Z',
          content: 'npm install',
          ansiContent: 'npm install'
        },
        // ... more log lines
      ],
      expanded: true
    }
  ]}
  jobName="Build & Test"
  jobStatus="success"
  gitHubLogsUrl="https://github.com/.../actions/runs/12345/attempts/1"
/>
```

### Using WorkflowRunsList Component

```typescript
import WorkflowRunsList from './components/pipeline/WorkflowRunsList';

<WorkflowRunsList
  owner="myorg"
  repo="myrepo"
  packageName="my-package"  // optional
  onSelectRun={(runId) => {
    // Handle run selection
    setSelectedRun(runId);
  }}
  limit={20}
/>
```

### Using WorkflowTrigger Component

```typescript
import WorkflowTrigger from './components/pipeline/WorkflowTrigger';

<WorkflowTrigger
  owner="myorg"
  repo="myrepo"
  workflowId="release.yml"
  defaultBranch="main"
  onSuccess={(runUrl) => {
    console.log('Workflow triggered:', runUrl);
  }}
  onError={(error) => {
    console.error('Failed to trigger:', error);
  }}
  pipelineId="pipeline_id_123"
/>
```

### Using PipelineManager Component

```typescript
import PipelineManager from './components/pipeline/PipelineManager';

<PipelineManager
  owner="myorg"
  repo="myrepo"
  packageName="my-package"  // optional
  onNavigate={(path) => {
    // Handle navigation
    navigate(path);
  }}
/>
```

### Fetching Data in Components

```typescript
// Fetch pipelines
const response = await fetch('/api/pipelines?limit=20&offset=0');
const pipelines = await response.json();

// Fetch workflow runs
const response = await fetch(
  '/api/workflows/owner/repo?status=in_progress&page=1'
);
const { runs, totalCount, rateLimit } = await response.json();

// Fetch jobs
const response = await fetch(
  '/api/workflows/owner/repo/runs/12345'
);
const { run, jobs, totalCount, rateLimit } = await response.json();

// Fetch logs
const response = await fetch(
  '/api/workflows/owner/repo/jobs/98765/logs'
);
const { logs, rateLimit } = await response.json();

// Trigger workflow
const response = await fetch(
  '/api/workflows/owner/repo/trigger',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: 'release.yml',
      ref: 'main',
      inputs: { version: '1.2.0' },
      pipelineId: 'pipeline_123'
    })
  }
);
const result = await response.json();

// Cancel workflow
const response = await fetch(
  '/api/workflows/owner/repo/runs/12345/cancel',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipelineId: 'pipeline_123' })
  }
);

// Re-run workflow
const response = await fetch(
  '/api/workflows/owner/repo/runs/12345/rerun',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      failedOnly: false,
      pipelineId: 'pipeline_123'
    })
  }
);

// Get audit logs
const response = await fetch(
  '/api/pipelines/pipeline_123/audit-logs?limit=50&offset=0'
);
const logs = await response.json();

// Check rate limits
const response = await fetch('/api/rate-limit');
const { limit, remaining, reset } = await response.json();
```

## 🗄️ Database Query Examples

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all pipelines for a package
const pipelines = await prisma.releasePipeline.findMany({
  where: {
    packageName: 'my-package',
    owner: 'myorg',
    repo: 'myrepo'
  },
  include: {
    workflowRuns: {
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
});

// Get recent pipelines
const recent = await prisma.releasePipeline.findMany({
  orderBy: { triggeredAt: 'desc' },
  take: 20,
  include: {
    workflowRuns: true
  }
});

// Get workflow runs for a pipeline
const runs = await prisma.workflowRun.findMany({
  where: { pipelineId: 'pipeline_123' },
  include: {
    jobs: {
      include: {
        steps: true,
        logs: true
      }
    }
  }
});

// Get jobs for a run
const jobs = await prisma.workflowJob.findMany({
  where: { runId: 'run_123' },
  include: {
    steps: true,
    logs: true
  }
});

// Get logs for a job
const logs = await prisma.jobLog.findUnique({
  where: { jobId: 'job_123' }
});

// Get audit logs
const auditLogs = await prisma.pipelineAuditLog.findMany({
  where: { pipelineId: 'pipeline_123' },
  orderBy: { timestamp: 'desc' },
  take: 50
});

// Get failed runs
const failedRuns = await prisma.workflowRun.findMany({
  where: {
    pipelineId: 'pipeline_123',
    conclusion: 'failure'
  }
});

// Get runs by status
const running = await prisma.workflowRun.findMany({
  where: {
    pipelineId: 'pipeline_123',
    status: 'in_progress'
  }
});

// Delete old pipelines
const deleted = await prisma.releasePipeline.deleteMany({
  where: {
    createdAt: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  }
});
```

## 🔄 Common Workflows

### Monitor a Release

```typescript
// 1. Create pipeline
const pipeline = await pipelineService.createOrUpdatePipeline({
  releaseVersion: '1.2.0',
  packageName: 'my-package',
  owner: 'owner',
  repo: 'repo',
  workflowId: 123,
  workflowName: 'Release',
  triggerType: 'manual',
  triggeredBy: 'john.doe',
  triggeredAt: new Date(),
  currentStatus: 'queued',
  currentConclusion: null
});

// 2. Poll for updates
const pollPipeline = setInterval(async () => {
  const { runs } = await githubActionsService.getWorkflowRuns(
    'owner',
    'repo',
    accessToken,
    { workflowId: 123 }
  );

  for (const run of runs) {
    await pipelineService.storeWorkflowRun(pipeline.id, run);

    if (run.status === 'completed') {
      const { jobs } = await githubActionsService.getWorkflowRunJobs(
        'owner',
        'repo',
        run.id,
        accessToken
      );

      await pipelineService.storeWorkflowJobs(
        run.id.toString(),
        jobs
      );

      // Update pipeline status
      await pipelineService.createOrUpdatePipeline({
        ...pipeline,
        currentStatus: run.status,
        currentConclusion: run.conclusion,
        lastRunId: run.id
      });
    }
  }
}, 5000); // Poll every 5 seconds
```

### Handle Log Streaming

```typescript
// Get and parse logs
const { logs } = await githubActionsService.getJobLogs(
  'owner',
  'repo',
  jobId,
  accessToken
);

const jobDetails = await githubActionsService.getWorkflowRunJobs(
  'owner',
  'repo',
  runId,
  accessToken
);

const job = jobDetails.jobs[0];

// Parse logs into steps
const steps = githubActionsService.parseJobLogs(logs, job);

// Store in database
await pipelineService.storeJobLogs(
  `job_${jobId}`,
  {
    jobId,
    jobName: job.name,
    steps,
    hasPreviousLogs: false,
    hasMoreLogs: steps.some(s => s.logs.length > 1000)
  },
  job.html_url
);
```

### Trigger and Monitor Workflow

```typescript
// Trigger
const { response, rateLimit } = 
  await githubActionsService.triggerWorkflow(accessToken, {
    owner: 'owner',
    repo: 'repo',
    workflow: 'release.yml',
    ref: 'main',
    inputs: { version: '1.2.0' }
  });

if (response.success) {
  // Create pipeline
  const pipeline = await pipelineService.createOrUpdatePipeline({
    releaseVersion: '1.2.0',
    packageName: 'my-package',
    owner: 'owner',
    repo: 'repo',
    workflowId: 123,
    workflowName: 'Release',
    triggerType: 'manual',
    triggeredBy: 'john.doe',
    triggeredAt: new Date(),
    currentStatus: 'queued',
    currentConclusion: null
  });

  // Audit log
  await pipelineService.createAuditLog(
    pipeline.id,
    userId,
    username,
    'trigger',
    'workflow_run',
    'workflow_123',
    'Release Workflow Triggered',
    { version: '1.2.0' },
    'success'
  );
}
```

## 📊 Error Handling Examples

```typescript
try {
  const { runs } = await githubActionsService.getWorkflowRuns(
    owner,
    repo,
    accessToken
  );
} catch (error) {
  // Handle errors
  if (error.message.includes('401')) {
    // Token expired
  } else if (error.message.includes('403')) {
    // Permission denied
  } else if (error.message.includes('404')) {
    // Repository not found
  } else if (error.message.includes('rate limit')) {
    // Rate limit exceeded - exponential backoff
  } else {
    // Generic error
    console.error('Failed to fetch workflows:', error);
  }
}
```

## 🎨 ANSI Code Examples

```typescript
// Raw log with ANSI codes from GitHub
const rawLog = `
\u001b[36m##[group]Install Dependencies\u001b[0m
npm install
\u001b[32m✓ Installed 125 packages\u001b[0m
\u001b[36m##[endgroup]\u001b[0m

\u001b[36m##[group]Build\u001b[0m
npm run build
\u001b[1;33mWarning: Deprecated API\u001b[0m
\u001b[36m##[endgroup]\u001b[0m
`;

// Parser will handle this automatically
const steps = githubActionsService.parseJobLogs(rawLog, job);
// Returns:
// [
//   {
//     stepName: "Install Dependencies",
//     logs: [
//       { content: "npm install", ansiContent: "npm install" },
//       { content: "✓ Installed 125 packages", ansiContent: "\u001b[32m✓ Installed 125 packages\u001b[0m" }
//     ]
//   },
//   {
//     stepName: "Build",
//     logs: [...]
//   }
// ]
```

---

**Note**: These examples assume you have the necessary authentication and error handling in place. Always wrap async calls in try-catch blocks for production code.
