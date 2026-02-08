import express from 'express';
import {
  getPublishPackages,
  getPublishChangesets,
  previewPublish,
  createChangeset,
  checkPublishStatus,
  triggerPublish,
} from '../controllers/publish-controller';
import { authenticationMiddleware } from '../middleware/auth-middleware';

const publishRouter = express.Router();

/**
 * GET /api/publish/packages
 * Get all workspace packages for publishing
 */
publishRouter.get('/packages', authenticationMiddleware, getPublishPackages);

/**
 * GET /api/publish/changesets
 * Get existing unpublished changesets
 */
publishRouter.get('/changesets', authenticationMiddleware, getPublishChangesets);

/**
 * POST /api/publish/preview
 * Preview the publish plan (calculate new versions, affected packages)
 */
publishRouter.post('/preview', authenticationMiddleware, previewPublish);

/**
 * POST /api/publish/changesets
 * Create a new changeset for the selected packages
 */
publishRouter.post('/changesets', authenticationMiddleware, createChangeset);

/**
 * GET /api/publish/status
 * Check publish readiness (working tree, changesets, etc.)
 */
publishRouter.get('/status', authenticationMiddleware, checkPublishStatus);

/**
 * POST /api/publish/trigger
 * Trigger the publishing workflow
 */
publishRouter.post('/trigger', authenticationMiddleware, triggerPublish);

export default publishRouter;
