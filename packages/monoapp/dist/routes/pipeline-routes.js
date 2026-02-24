"use strict";
/**
 * GitHub Actions and Release Pipeline Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPipelineRoutes = setupPipelineRoutes;
const auth_middleware_1 = require("../middleware/auth-middleware");
const pipeline_controller_1 = require("../controllers/pipeline-controller");
function setupPipelineRoutes(router) {
    /**
     * GET /api/pipelines
     * Get recent pipelines for the dashboard
     */
    router.get('/pipelines', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.getRecentPipelines);
    /**
     * PUT /api/pipelines/:pipelineId/status
     * Update pipeline status based on latest workflow run
     */
    router.put('/pipelines/:pipelineId/status', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.updatePipelineStatus);
    /**
     * GET /api/workflows/:owner/:repo/available
     * List available workflows in a repository
     */
    router.get('/workflows/:owner/:repo/available', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.listAvailableWorkflows);
    /**
     * GET /api/workflows/:owner/:repo
     * Get workflow runs for a repository
     */
    router.get('/workflows/:owner/:repo', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.getWorkflowRuns);
    /**
     * GET /api/workflows/:owner/:repo/runs/:runId
     * Get specific workflow run with jobs
     */
    router.get('/workflows/:owner/:repo/runs/:runId', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.getWorkflowRunWithJobs);
    /**
     * GET /api/workflows/:owner/:repo/jobs/:jobId/logs
     * Get logs for a job
     */
    router.get('/workflows/:owner/:repo/jobs/:jobId/logs', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.getJobLogs);
    /**
     * POST /api/workflows/:owner/:repo/trigger
     * Trigger a workflow
     */
    router.post('/workflows/:owner/:repo/trigger', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.triggerWorkflow);
    /**
     * POST /api/workflows/:owner/:repo/runs/:runId/cancel
     * Cancel a workflow run
     */
    router.post('/workflows/:owner/:repo/runs/:runId/cancel', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.cancelWorkflowRun);
    /**
     * POST /api/workflows/:owner/:repo/runs/:runId/rerun
     * Re-run a workflow
     */
    router.post('/workflows/:owner/:repo/runs/:runId/rerun', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.rerunWorkflow);
    /**
     * GET /api/pipelines/:pipelineId/audit-logs
     * Get audit logs for a pipeline
     */
    router.get('/pipelines/:pipelineId/audit-logs', auth_middleware_1.authenticationMiddleware, pipeline_controller_1.getPipelineAuditLogs);
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
