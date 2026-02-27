"use strict";
/**
 * Authentication Controller
 * Thin controller that handles HTTP concerns and delegates business logic to auth-service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.refresh = exports.logout = exports.validate = exports.me = exports.callback = exports.login = void 0;
const auth_service_1 = require("../services/auth-service");
const logger_1 = require("../middleware/logger");
/**
 * Start OAuth login flow
 * GET /auth/login
 */
const login = (req, res) => {
    try {
        const redirectUrl = req.query.redirect || '/';
        const result = (0, auth_service_1.initiateLogin)(redirectUrl);
        res.json({
            success: true,
            authUrl: result.authUrl,
            message: 'Redirect to this URL to authenticate with GitHub',
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Login initiation failed: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: error instanceof Error ? error.message : 'Failed to initiate GitHub OAuth flow',
        });
    }
};
exports.login = login;
/**
 * OAuth callback handler
 * GET /auth/callback?code=...&state=...
 */
const callback = async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;
        // Handle OAuth errors from GitHub
        if (error) {
            logger_1.AppLogger.warn(`OAuth error: ${error} - ${error_description}`);
            res.status(400).json({
                success: false,
                error: error,
                message: error_description,
            });
            return;
        }
        if (!code || !state) {
            logger_1.AppLogger.warn('OAuth callback missing code or state');
            res.status(400).json({
                success: false,
                error: 'Missing parameters',
                message: 'OAuth code and state are required',
            });
            return;
        }
        const result = await (0, auth_service_1.handleOAuthCallback)(code, state);
        res.json({
            success: true,
            message: 'Authentication successful',
            ...result,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`OAuth callback failed: ${error}`);
        const message = error instanceof Error ? error.message : 'Failed to complete GitHub OAuth flow';
        if (message.includes('CSRF')) {
            res.status(400).json({
                success: false,
                error: 'Invalid state',
                message,
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Authentication failed',
                message,
            });
        }
    }
};
exports.callback = callback;
/**
 * Get current user session
 * GET /auth/me
 */
const me = (req, res) => {
    try {
        const session = (0, auth_service_1.getCurrentSession)(req);
        res.json({
            success: true,
            ...session,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to get user session: ${error}`);
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Failed to retrieve user information',
        });
    }
};
exports.me = me;
/**
 * Validate session
 * POST /auth/validate
 */
const validate = async (req, res) => {
    try {
        const result = await (0, auth_service_1.validateCurrentSession)(req);
        res.json({
            success: true,
            ...result,
            message: 'Session is valid',
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Session validation failed: ${error}`);
        if (error instanceof Error && error.message.includes('no longer valid')) {
            res.status(401).json({
                success: false,
                valid: false,
                error: 'Unauthorized',
                message: error.message,
            });
        }
        else {
            res.status(500).json({
                success: false,
                valid: false,
                error: 'Validation failed',
                message: error instanceof Error ? error.message : 'Failed to validate session',
            });
        }
    }
};
exports.validate = validate;
/**
 * Logout
 * POST /auth/logout
 */
const logout = (req, res) => {
    try {
        (0, auth_service_1.logoutUser)(req);
        res.json({
            success: true,
            message: 'Logout successful',
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Logout failed: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            message: error instanceof Error ? error.message : 'Failed to logout',
        });
    }
};
exports.logout = logout;
/**
 * Refresh session (token)
 * POST /auth/refresh
 */
const refresh = async (req, res) => {
    try {
        const result = await (0, auth_service_1.refreshUserSession)(req);
        res.json({
            success: true,
            message: 'Session refreshed successfully',
            ...result,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Session refresh failed: ${error}`);
        if (error instanceof Error && error.message.includes('no longer valid')) {
            res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: error.message,
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Refresh failed',
                message: error instanceof Error ? error.message : 'Failed to refresh session',
            });
        }
    }
};
exports.refresh = refresh;
