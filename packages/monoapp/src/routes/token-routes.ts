/**
 * Token Management Routes
 * API endpoints for managing GitHub and NPM tokens
 */

import express from 'express';
import { authenticationMiddleware } from '../middleware/auth-middleware';
import {
  updateToken,
  getTokenStatus,
  validateToken,
  generateShortLivedGitHubToken,
} from '../controllers/token-controller';

const tokenRouter = express.Router();

/**
 * POST /api/tokens/update
 * Update GitHub or NPM token
 * Requires: authentication
 */
tokenRouter.post(
  '/update',
  authenticationMiddleware,
  updateToken
);

/**
 * GET /api/tokens/status
 * Get status of configured tokens
 * Requires: authentication
 */
tokenRouter.get(
  '/status',
  authenticationMiddleware,
  getTokenStatus
);

/**
 * POST /api/tokens/validate
 * Validate token format and optionally test it
 * Requires: authentication
 */
tokenRouter.post(
  '/validate',
  authenticationMiddleware,
  validateToken
);

/**
 * POST /api/tokens/generate-github-token
 * Generate a short-lived GitHub token using OAuth credentials
 * Requires: authentication
 */
tokenRouter.post(
  '/generate-github-token',
  authenticationMiddleware,
  generateShortLivedGitHubToken
);

export default tokenRouter;
