/**
 * GitHub Actions and Release Pipeline Routes
 */
import express from 'express';
import { authenticationMiddleware } from '../middleware/auth-middleware';
import {
  getRecentPipelines,
  updatePipelineStatus,
  getPipelineAuditLogs,
  getPipelineLogs,
  getRecentPipelineLogs,
  getLogsByStage,
  getErrorLogs,
} from '../controllers/pipeline-controller';

const pipelineRouter = express.Router();

/**
 * GET /api/pipelines
 * Get recent pipelines for the dashboard
 */
pipelineRouter.get('/', authenticationMiddleware, getRecentPipelines);

/**
 * PUT /api/pipelines/:pipelineId/status
 * Update pipeline status based on latest workflow run
 */
pipelineRouter.put(
  '/:pipelineId/status',
  authenticationMiddleware,
  updatePipelineStatus
);

/**
 * GET /api/pipelines/:pipelineId/audit-logs
 * Get audit logs for a pipeline
 */
pipelineRouter.get(
  '/:pipelineId/audit-logs',
  authenticationMiddleware,
  getPipelineAuditLogs
);

/**
 * GET /api/pipelines/:pipelineId/logs
 * Get detailed execution logs for a pipeline (with optional filters)
 */
pipelineRouter.get(
  '/:pipelineId/logs',
  authenticationMiddleware,
  getPipelineLogs
);

/**
 * GET /api/pipelines/logs/recent
 * Get recent logs across all pipelines
 */
pipelineRouter.get(
  '/logs/recent',
  authenticationMiddleware,
  getRecentPipelineLogs
);

/**
 * GET /api/pipelines/:pipelineId/logs/stage/:stage
 * Get logs filtered by stage
 */
pipelineRouter.get(
  '/:pipelineId/logs/stage/:stage',
  authenticationMiddleware,
  getLogsByStage
);

/**
 * GET /api/pipelines/:pipelineId/logs/errors
 * Get error logs for a pipeline
 */
pipelineRouter.get(
  '/:pipelineId/logs/errors',
  authenticationMiddleware,
  getErrorLogs
);

export default pipelineRouter;

