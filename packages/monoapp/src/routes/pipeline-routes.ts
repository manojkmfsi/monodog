/**
 * GitHub Actions and Release Pipeline Routes
 */

import type { Router } from 'express';
import { authenticationMiddleware } from '../middleware/auth-middleware';
import {
getRecentPipelines,
updatePipelineStatus,
listAvailableWorkflows,
getWorkflowRuns,
getWorkflowRunWithJobs,
getJobLogs,
triggerWorkflow,
cancelWorkflowRun,
rerunWorkflow,
getPipelineAuditLogs
} from '../controllers/pipeline-controller';

export function setupPipelineRoutes(router: Router): void {
  /**
   * GET /api/pipelines
   * Get recent pipelines for the dashboard
   */
  router.get('/pipelines', authenticationMiddleware, getRecentPipelines);

  /**
   * PUT /api/pipelines/:pipelineId/status
   * Update pipeline status based on latest workflow run
   */
  router.put(
    '/pipelines/:pipelineId/status',
    authenticationMiddleware,
updatePipelineStatus
  );

  /**
   * GET /api/workflows/:owner/:repo/available
   * List available workflows in a repository
   */
  router.get(
    '/workflows/:owner/:repo/available',
    authenticationMiddleware,
listAvailableWorkflows
  );

  /**
   * GET /api/workflows/:owner/:repo
   * Get workflow runs for a repository
   */
  router.get(
    '/workflows/:owner/:repo',
    authenticationMiddleware,
    getWorkflowRuns,
  );

  /**
   * GET /api/workflows/:owner/:repo/runs/:runId
   * Get specific workflow run with jobs
   */
  router.get(
    '/workflows/:owner/:repo/runs/:runId',
    authenticationMiddleware,
    getWorkflowRunWithJobs
  );

  /**
   * GET /api/workflows/:owner/:repo/jobs/:jobId/logs
   * Get logs for a job
   */
  router.get(
    '/workflows/:owner/:repo/jobs/:jobId/logs',
    authenticationMiddleware,
    getJobLogs
  );

  /**
   * POST /api/workflows/:owner/:repo/trigger
   * Trigger a workflow
   */
  router.post(
    '/workflows/:owner/:repo/trigger',
    authenticationMiddleware,
    triggerWorkflow
  );

  /**
   * POST /api/workflows/:owner/:repo/runs/:runId/cancel
   * Cancel a workflow run
   */
  router.post(
    '/workflows/:owner/:repo/runs/:runId/cancel',
    authenticationMiddleware,
cancelWorkflowRun
  );

  /**
   * POST /api/workflows/:owner/:repo/runs/:runId/rerun
   * Re-run a workflow
   */
  router.post(
    '/workflows/:owner/:repo/runs/:runId/rerun',
    authenticationMiddleware,
rerunWorkflow
  );

  /**
   * GET /api/pipelines/:pipelineId/audit-logs
   * Get audit logs for a pipeline
   */
  router.get(
    '/pipelines/:pipelineId/audit-logs',
    authenticationMiddleware,
getPipelineAuditLogs
  );

  /**
   * GET /api/rate-limit
   * Get GitHub API rate limit information
   */
  // router.get('/rate-limit', authenticationMiddleware, async (req: Request, res: Response) => {
  //   try {
  //     if (!req.user || !req.accessToken) {
  //       return res.status(401).json({ error: 'Unauthorized' });
  //     }

  //     const rateLimit = await githubActionsService.getRateLimit(req.accessToken);
  //     res.json(rateLimit);
  //   } catch (error) {
  //     AppLogger.error(`Error getting rate limit: ${error}`);
  //     res.status(500).json({ error: 'Failed to get rate limit' });
  //   }
  // });
}
