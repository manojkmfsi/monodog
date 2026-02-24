/**
 * Pipeline Controller
 * Handles HTTP requests and responses for pipeline operations
 * Delegates business logic to pipeline service
 */

import { Request, Response } from 'express';
import { AppLogger } from '../middleware/logger';
import * as pipelineService from '../services/pipeline-service';
import * as githubActionsService from '../services/github-actions-service';

declare module 'express' {
  interface Request {
    user?: {
      id: number;
      login: string;
      avatar_url: string;
    };
    accessToken?: string;
  }
}

/**
 * Get recent pipelines for the dashboard
 * GET /api/pipelines
 */
export async function getRecentPipelines(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const pipelines = await pipelineService.getRecentPipelines(limit, offset);
    res.json(pipelines);
  } catch (error) {
    AppLogger.error(`Error getting pipelines: ${error}`);
    res.status(500).json({ error: 'Failed to get pipelines' });
  }
}

/**
 * Update pipeline status based on latest workflow run
 * PUT /api/pipelines/:pipelineId/status
 */
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



/**
 * Get available workflows in a repository
 * GET /api/workflows/:owner/:repo/available
 */
export async function listAvailableWorkflows(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo } = req.params;

    const result = await githubActionsService.listWorkflows(
      owner,
      repo,
      req.accessToken
    );

    res.json(result);
  } catch (error) {
    AppLogger.error(`Error listing workflows: ${error}`);
    res.status(500).json({ error: 'Failed to list workflows' });
  }
}

/**
 * Get workflow runs for a repository
 * GET /api/workflows/:owner/:repo
 */
export async function getWorkflowRuns(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo } = req.params;
    const workflowId = req.query.workflow_id as string;
    const workflowPath = req.query.workflow_path as string;
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 30;

    AppLogger.info(
      `GET /workflows/${owner}/${repo}: workflowId=${workflowId}, workflowPath=${workflowPath}, status=${status}, page=${page}, per_page=${per_page}`
    );

    const result = await githubActionsService.getWorkflowRuns(
      owner,
      repo,
      req.accessToken,
      {
        workflowId,
        workflowPath,
        status,
        page,
        per_page,
      }
    );

    AppLogger.info(
      `GET /workflows/${owner}/${repo}: Returned ${result.runs.length} runs (total: ${result.totalCount})`
    );
    res.json(result);
  } catch (error) {
    AppLogger.error(`Error getting workflows: ${error}`);
    res.status(500).json({ error: 'Failed to get workflows' });
  }
}

/**
 * Get specific workflow run with jobs
 * GET /api/workflows/:owner/:repo/runs/:runId
 */
export async function getWorkflowRunWithJobs(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo, runId } = req.params;
    const page = parseInt(req.query.page as string) || 1;

    // Get run details
    const { run, rateLimit: runRateLimit } = await githubActionsService.getWorkflowRun(
      owner,
      repo,
      parseInt(runId),
      req.accessToken
    );

    // Get jobs
    const { jobs, totalCount, rateLimit: jobsRateLimit } = await githubActionsService.getWorkflowRunJobs(
      owner,
      repo,
      parseInt(runId),
      req.accessToken,
      page
    );

    // Transform jobs to match frontend expectations
    const transformedJobs = jobs.map((job: any) => ({
      id: job.id,
      gitHubJobId: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion || null,
      htmlUrl: job.html_url,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    }));

    res.json({
      run,
      jobs: transformedJobs,
      pagination: {
        page,
        totalCount,
        pageSize: transformedJobs.length,
      },
      rateLimit: {
        limit: runRateLimit?.limit,
        remaining: runRateLimit?.remaining,
        reset: runRateLimit?.reset,
      },
    });
  } catch (error) {
    AppLogger.error(`Error getting workflow run: ${error}`);
    res.status(500).json({ error: 'Failed to get workflow run' });
  }
}

/**
 * Get job logs
 * GET /api/workflows/:owner/:repo/jobs/:jobId/logs
 */
export async function getJobLogs(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo, jobId } = req.params;

    AppLogger.info(
      `[LOGS] Fetching job logs: owner=${owner}, repo=${repo}, jobId=${jobId}, user=${req.user?.login}`
    );

    const { logs, rateLimit } = await githubActionsService.getJobLogs(
      owner,
      repo,
      parseInt(jobId),
      req.accessToken
    );

    AppLogger.info(`[LOGS] Successfully fetched ${logs.length} characters of logs`);

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
}

/**
 * Trigger a workflow run
 * POST /api/workflows/:owner/:repo/trigger
 */
export async function triggerWorkflow(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo } = req.params;
    const { pipelineId, workflowId, ref, inputs } = req.body;

    if (!workflowId || !ref) {
      return res.status(400).json({
        error: 'Missing required fields: workflowId, ref',
      });
    }

    const result = await githubActionsService.triggerWorkflow(
      req.accessToken,
      {
        owner,
        repo,
        workflow: workflowId,
        ref,
        inputs,
      }
    );
    if (pipelineId) {
      await pipelineService.createAuditLog(
        pipelineId,
        req.user.id,
        req.user.login,
        'trigger',
        'workflow',
        String(workflowId),
        `Trigger workflow`,
        {  },
        result.response.success ? 'success' : 'failure'
      );
    }
    res.json({
      success: result.response.success,
      message: result.response.message,
      rateLimit: result.rateLimit,
    });
  } catch (error) {
    AppLogger.error(`Error triggering workflow: ${error}`);
    res.status(500).json({ error: 'Failed to trigger workflow' });
  }
}

/**
 * Get pipeline audit logs
 * GET /api/pipelines/:pipelineId/audit
 */
export async function getPipelineAuditLogs(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pipelineId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await pipelineService.getPipelineAuditLogs(pipelineId, limit, offset);

    res.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    AppLogger.error(`Error getting audit logs: ${error}`);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}

/**
 * Cancel a workflow run
 * POST /api/workflows/:owner/:repo/runs/:runId/cancel
 */
export async function cancelWorkflowRun(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo, runId } = req.params;
    const { pipelineId } = req.body;

    const { success, rateLimit } = await githubActionsService.cancelWorkflowRun(
      owner,
      repo,
      parseInt(runId),
      req.accessToken
    );

    if (pipelineId) {
      await pipelineService.createAuditLog(
        pipelineId,
        req.user.id,
        req.user.login,
        'cancel',
        'workflow_run',
        String(runId),
        `Cancel workflow run ${runId}`,
        {},
        success ? 'success' : 'failure'
      );
    }

    res.json({ success, rateLimit });
  } catch (error) {
    AppLogger.error(`Error cancelling workflow: ${error}`);
    res.status(500).json({ error: 'Failed to cancel workflow' });
  }
}

/**
 * Rerun a workflow
 * POST /api/workflows/:owner/:repo/runs/:runId/rerun
 */
export async function rerunWorkflow(req: Request, res: Response) {
  try {
    if (!req.user || !req.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo, runId } = req.params;
    const { failedOnly = false, pipelineId } = req.body;

    const { success, rateLimit } = await githubActionsService.rerunWorkflow(
      owner,
      repo,
      parseInt(runId),
      req.accessToken,
      failedOnly
    );

    if (pipelineId) {
      await pipelineService.createAuditLog(
        pipelineId,
        req.user.id,
        req.user.login,
        'rerun',
        'workflow_run',
        String(runId),
        `Rerun workflow ${failedOnly ? '(failed jobs only)' : ''}`,
        { failedOnly },
        success ? 'success' : 'failure'
      );
    }

    res.json({ success, rateLimit });
  } catch (error) {
    AppLogger.error(`Error rerunning workflow: ${error}`);
    res.status(500).json({ error: 'Failed to rerun workflow' });
  }
}
