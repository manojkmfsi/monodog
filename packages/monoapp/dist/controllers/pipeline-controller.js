"use strict";
/**
 * Pipeline Controller
 * Handles HTTP requests and responses for pipeline operations
 * Delegates business logic to pipeline service
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentPipelines = getRecentPipelines;
exports.updatePipelineStatus = updatePipelineStatus;
exports.listAvailableWorkflows = listAvailableWorkflows;
exports.getWorkflowRuns = getWorkflowRuns;
exports.getWorkflowRunWithJobs = getWorkflowRunWithJobs;
exports.getJobLogs = getJobLogs;
exports.triggerWorkflow = triggerWorkflow;
exports.getPipelineAuditLogs = getPipelineAuditLogs;
exports.cancelWorkflowRun = cancelWorkflowRun;
exports.rerunWorkflow = rerunWorkflow;
const logger_1 = require("../middleware/logger");
const pipelineService = __importStar(require("../services/pipeline-service"));
const githubActionsService = __importStar(require("../services/github-actions-service"));
/**
 * Get recent pipelines for the dashboard
 * GET /api/pipelines
 */
async function getRecentPipelines(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const pipelines = await pipelineService.getRecentPipelines(limit, offset);
        res.json(pipelines);
    }
    catch (error) {
        logger_1.AppLogger.error(`Error getting pipelines: ${error}`);
        res.status(500).json({ error: 'Failed to get pipelines' });
    }
}
/**
 * Update pipeline status based on latest workflow run
 * PUT /api/pipelines/:pipelineId/status
 */
async function updatePipelineStatus(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { pipelineId } = req.params;
        const { currentStatus, currentConclusion, lastRunId } = req.body;
        if (!currentStatus) {
            return res.status(400).json({ error: 'currentStatus is required' });
        }
        const updatedPipeline = await pipelineService.updatePipelineStatus(pipelineId, currentStatus, currentConclusion || null, lastRunId ? String(lastRunId) : undefined);
        res.json({
            success: true,
            pipeline: updatedPipeline,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Error updating pipeline status: ${error}`);
        res.status(500).json({ error: 'Failed to update pipeline status' });
    }
}
/**
 * Get available workflows in a repository
 * GET /api/workflows/:owner/:repo/available
 */
async function listAvailableWorkflows(req, res) {
    try {
        if (!req.user || !req.accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { owner, repo } = req.params;
        const result = await githubActionsService.listWorkflows(owner, repo, req.accessToken);
        res.json(result);
    }
    catch (error) {
        logger_1.AppLogger.error(`Error listing workflows: ${error}`);
        res.status(500).json({ error: 'Failed to list workflows' });
    }
}
/**
 * Get workflow runs for a repository
 * GET /api/workflows/:owner/:repo
 */
async function getWorkflowRuns(req, res) {
    try {
        if (!req.user || !req.accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { owner, repo } = req.params;
        const workflowId = req.query.workflow_id;
        const workflowPath = req.query.workflow_path;
        const status = req.query.status;
        const page = parseInt(req.query.page) || 1;
        const per_page = parseInt(req.query.per_page) || 30;
        logger_1.AppLogger.info(`GET /workflows/${owner}/${repo}: workflowId=${workflowId}, workflowPath=${workflowPath}, status=${status}, page=${page}, per_page=${per_page}`);
        const result = await githubActionsService.getWorkflowRuns(owner, repo, req.accessToken, {
            workflowId,
            workflowPath,
            status,
            page,
            per_page,
        });
        logger_1.AppLogger.info(`GET /workflows/${owner}/${repo}: Returned ${result.runs.length} runs (total: ${result.totalCount})`);
        res.json(result);
    }
    catch (error) {
        logger_1.AppLogger.error(`Error getting workflows: ${error}`);
        res.status(500).json({ error: 'Failed to get workflows' });
    }
}
/**
 * Get specific workflow run with jobs
 * GET /api/workflows/:owner/:repo/runs/:runId
 */
async function getWorkflowRunWithJobs(req, res) {
    try {
        if (!req.user || !req.accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { owner, repo, runId } = req.params;
        const page = parseInt(req.query.page) || 1;
        // Get run details
        const { run, rateLimit: runRateLimit } = await githubActionsService.getWorkflowRun(owner, repo, parseInt(runId), req.accessToken);
        // Get jobs
        const { jobs, totalCount, rateLimit: jobsRateLimit } = await githubActionsService.getWorkflowRunJobs(owner, repo, parseInt(runId), req.accessToken, page);
        // Transform jobs to match frontend expectations
        const transformedJobs = jobs.map((job) => ({
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
    }
    catch (error) {
        logger_1.AppLogger.error(`Error getting workflow run: ${error}`);
        res.status(500).json({ error: 'Failed to get workflow run' });
    }
}
/**
 * Get job logs
 * GET /api/workflows/:owner/:repo/jobs/:jobId/logs
 */
async function getJobLogs(req, res) {
    try {
        if (!req.user || !req.accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { owner, repo, jobId } = req.params;
        logger_1.AppLogger.info(`[LOGS] Fetching job logs: owner=${owner}, repo=${repo}, jobId=${jobId}, user=${req.user?.login}`);
        const { logs, rateLimit } = await githubActionsService.getJobLogs(owner, repo, parseInt(jobId), req.accessToken);
        logger_1.AppLogger.info(`[LOGS] Successfully fetched ${logs.length} characters of logs`);
        res.json({
            logs: logs || '',
            rateLimit,
            meta: {
                size: logs.length,
                isEmpty: !logs || logs.trim().length === 0,
            },
        });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger_1.AppLogger.error(`[LOGS ERROR] Failed to fetch job logs: ${errorMsg}`);
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
async function triggerWorkflow(req, res) {
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
        const result = await githubActionsService.triggerWorkflow(req.accessToken, {
            owner,
            repo,
            workflow: workflowId,
            ref,
            inputs,
        });
        if (pipelineId) {
            await pipelineService.createAuditLog(pipelineId, req.user.id, req.user.login, 'trigger', 'workflow', String(workflowId), `Trigger workflow`, {}, result.response.success ? 'success' : 'failure');
        }
        res.json({
            success: result.response.success,
            message: result.response.message,
            rateLimit: result.rateLimit,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Error triggering workflow: ${error}`);
        res.status(500).json({ error: 'Failed to trigger workflow' });
    }
}
/**
 * Get pipeline audit logs
 * GET /api/pipelines/:pipelineId/audit
 */
async function getPipelineAuditLogs(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { pipelineId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);
        const offset = parseInt(req.query.offset) || 0;
        const logs = await pipelineService.getPipelineAuditLogs(pipelineId, limit, offset);
        res.json({
            success: true,
            logs,
            count: logs.length,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Error getting audit logs: ${error}`);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
}
/**
 * Cancel a workflow run
 * POST /api/workflows/:owner/:repo/runs/:runId/cancel
 */
async function cancelWorkflowRun(req, res) {
    try {
        if (!req.user || !req.accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { owner, repo, runId } = req.params;
        const { pipelineId } = req.body;
        const { success, rateLimit } = await githubActionsService.cancelWorkflowRun(owner, repo, parseInt(runId), req.accessToken);
        if (pipelineId) {
            await pipelineService.createAuditLog(pipelineId, req.user.id, req.user.login, 'cancel', 'workflow_run', String(runId), `Cancel workflow run ${runId}`, {}, success ? 'success' : 'failure');
        }
        res.json({ success, rateLimit });
    }
    catch (error) {
        logger_1.AppLogger.error(`Error cancelling workflow: ${error}`);
        res.status(500).json({ error: 'Failed to cancel workflow' });
    }
}
/**
 * Rerun a workflow
 * POST /api/workflows/:owner/:repo/runs/:runId/rerun
 */
async function rerunWorkflow(req, res) {
    try {
        if (!req.user || !req.accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { owner, repo, runId } = req.params;
        const { failedOnly = false, pipelineId } = req.body;
        const { success, rateLimit } = await githubActionsService.rerunWorkflow(owner, repo, parseInt(runId), req.accessToken, failedOnly);
        if (pipelineId) {
            await pipelineService.createAuditLog(pipelineId, req.user.id, req.user.login, 'rerun', 'workflow_run', String(runId), `Rerun workflow ${failedOnly ? '(failed jobs only)' : ''}`, { failedOnly }, success ? 'success' : 'failure');
        }
        res.json({ success, rateLimit });
    }
    catch (error) {
        logger_1.AppLogger.error(`Error rerunning workflow: ${error}`);
        res.status(500).json({ error: 'Failed to rerun workflow' });
    }
}
