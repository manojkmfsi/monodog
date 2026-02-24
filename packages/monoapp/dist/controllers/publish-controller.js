"use strict";
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
exports.getPublishPackages = getPublishPackages;
exports.getPublishChangesets = getPublishChangesets;
exports.previewPublish = previewPublish;
exports.createChangeset = createChangeset;
exports.checkPublishStatus = checkPublishStatus;
exports.triggerPublish = triggerPublish;
const logger_1 = require("../middleware/logger");
const changeset_service_1 = require("../services/changeset-service");
const pipelineService = __importStar(require("../services/pipeline-service"));
const utilities_1 = require("../utils/utilities");
const github_actions_service_1 = require("../services/github-actions-service");
/**
 * Get all workspace packages
 */
async function getPublishPackages(req, res) {
    try {
        const rootPath = req.app.locals.rootPath;
        const packages = await (0, changeset_service_1.getWorkspacePackages)(rootPath);
        // Filter out private packages for UI display
        const publicPackages = packages.filter((pkg) => !pkg.private);
        res.json({
            success: true,
            packages: publicPackages,
            total: publicPackages.length,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to fetch packages: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch packages',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
/**
 * Get existing unpublished changesets
 */
async function getPublishChangesets(req, res) {
    try {
        const rootPath = req.app.locals.rootPath;
        const changesets = await (0, changeset_service_1.getExistingChangesets)(rootPath);
        res.json({
            success: true,
            changesets,
            total: changesets.length,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to fetch changesets: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch changesets',
        });
    }
}
/**
 * Preview publish plan (calculate new versions, affected packages)
 */
async function previewPublish(req, res) {
    try {
        const { packages: selectedPackageNames, bumps } = req.body;
        if (!selectedPackageNames || !Array.isArray(selectedPackageNames)) {
            res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'packages array is required',
            });
            return;
        }
        const rootPath = req.app.locals.rootPath;
        const allPackages = await (0, changeset_service_1.getWorkspacePackages)(rootPath);
        // Filter selected packages
        const selectedPackages = allPackages.filter((pkg) => selectedPackageNames.includes(pkg.name));
        // Calculate new versions
        const newVersions = (0, changeset_service_1.calculateNewVersions)(selectedPackages, bumps || []);
        // Check if working tree is clean
        const isClean = await (0, changeset_service_1.isWorkingTreeClean)(rootPath);
        // Get existing changesets
        const changesets = await (0, changeset_service_1.getExistingChangesets)(rootPath);
        // Perform validation checks
        const errors = [];
        const warnings = [];
        // Get authenticated user
        const authUser = req.user;
        const userPermission = req.permission.permission || 'read';
        // Check 1: Working tree clean
        const workingTreeClean = isClean;
        if (!workingTreeClean) {
            errors.push('Working tree has uncommitted changes');
        }
        // Check 2: User permissions
        const permissionHierarchy = {
            admin: 4,
            maintain: 3,
            write: 2,
            read: 1,
            none: 0,
        };
        const userLevel = permissionHierarchy[userPermission] || 0;
        const requiredLevel = permissionHierarchy['write'] || 0;
        const permissions = userLevel >= requiredLevel;
        if (!permissions) {
            errors.push(`Insufficient permissions. Required: write, Got: ${userPermission}`);
        }
        // Check 3: CI passing (simplified - always true for now)
        const ciPassing = true;
        // Check 4: Version available on npm (simplified - always true for now)
        const versionAvailable = true;
        logger_1.AppLogger.info(`Publishing preview for user: ${authUser?.login} (permission: ${userPermission})`);
        const isValid = errors.length === 0;
        res.json({
            success: true,
            isValid,
            errors,
            warnings,
            checks: {
                permissions,
                workingTreeClean,
                ciPassing,
                versionAvailable,
            },
            preview: {
                packages: newVersions,
                workingTreeClean: isClean,
                existingChangesets: changesets.length,
                affectedPackages: newVersions.length,
            },
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to preview publish: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to preview publish',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
/**
 * Create a new changeset
 */
async function createChangeset(req, res) {
    try {
        const { packages: selectedPackageNames, bumps, summary } = req.body;
        const authUser = req.user;
        const userPermission = req.permission.permission || 'read';
        if (!selectedPackageNames || !Array.isArray(selectedPackageNames)) {
            res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'packages array is required',
            });
            return;
        }
        if (!summary || typeof summary !== 'string' || summary.length < 10) {
            res.status(400).json({
                success: false,
                error: 'Invalid summary',
                message: 'Summary must be at least 10 characters',
            });
            return;
        }
        // Check permissions
        const permissionHierarchy = {
            admin: 4,
            maintain: 3,
            write: 2,
            read: 1,
            none: 0,
        };
        const userLevel = permissionHierarchy[userPermission] || 0;
        const requiredLevel = permissionHierarchy['write'] || 0;
        if (userLevel < requiredLevel) {
            logger_1.AppLogger.warn(`User ${authUser?.login} attempted to create changeset without write permission`);
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `This action requires write permission. You have: ${userPermission}`,
            });
            return;
        }
        const rootPath = req.app.locals.rootPath;
        logger_1.AppLogger.info(`Creating changeset for user: ${authUser?.login} (permission: ${userPermission})`);
        // Generate the changeset
        const result = await (0, changeset_service_1.generateChangeset)(rootPath, selectedPackageNames, bumps || [], summary, authUser?.login);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Failed to create changeset',
                message: result.message,
            });
            return;
        }
        res.json({
            success: true,
            changeset: result.changeset,
            message: 'Changeset created successfully',
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to create changeset: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to create changeset',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
/**
 * Check publish readiness
 */
async function checkPublishStatus(req, res) {
    try {
        const rootPath = req.app.locals.rootPath;
        // Check if working tree is clean
        const isClean = await (0, changeset_service_1.isWorkingTreeClean)(rootPath);
        // Get existing changesets
        const changesets = await (0, changeset_service_1.getExistingChangesets)(rootPath);
        res.json({
            success: true,
            status: {
                workingTreeClean: isClean,
                hasChangesets: changesets.length > 0,
                changesetCount: changesets.length,
                readyToPublish: isClean && changesets.length > 0,
            },
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to check publish status: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to check publish status',
        });
    }
}
/**
 * Trigger publishing workflow
 */
async function triggerPublish(req, res) {
    try {
        const rootPath = req.app.locals.rootPath;
        const authUser = req.user;
        const userPermission = req.permission.permission || 'read';
        const { packages: selectedPackages } = req.body;
        const selectedPackageNames = selectedPackages?.map((pkg) => pkg.name) || [];
        // Check permissions
        const permissionHierarchy = {
            admin: 4,
            maintain: 3,
            write: 2,
            read: 1,
            none: 0,
        };
        const userLevel = permissionHierarchy[userPermission] || 0;
        const requiredLevel = permissionHierarchy['maintain'] || 0;
        if (userLevel < requiredLevel) {
            logger_1.AppLogger.warn(`User ${authUser?.login} attempted to trigger publish without maintain permission`);
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `This action requires maintain permission. You have: ${userPermission}`,
            });
            return;
        }
        // Check if working tree is clean
        const isClean = await (0, changeset_service_1.isWorkingTreeClean)(rootPath);
        if (!isClean) {
            res.status(400).json({
                success: false,
                error: 'Working tree not clean',
                message: 'Please commit or stash all changes before publishing',
            });
            return;
        }
        // Check if changesets exist
        const changesets = await (0, changeset_service_1.getExistingChangesets)(rootPath);
        if (changesets.length === 0) {
            res.status(400).json({
                success: false,
                error: 'No changesets found',
                message: 'Create changesets before publishing',
            });
            return;
        }
        logger_1.AppLogger.info(`Triggering publish for user: ${authUser?.login} (permission: ${userPermission})`);
        // Trigger publish pipeline with user context and package info
        const result = await (0, changeset_service_1.triggerPublishPipeline)(rootPath, authUser?.login, selectedPackages);
        if (!result.success) {
            res.status(500).json({
                success: false,
                error: 'Failed to trigger publish pipeline',
                message: result.message,
            });
            return;
        }
        // Create pipeline records in database for each package
        logger_1.AppLogger.info(`Checking if should create pipelines: selectedPackageNames=${JSON.stringify(selectedPackageNames)}, isArray=${Array.isArray(selectedPackageNames)}`);
        if (selectedPackages && Array.isArray(selectedPackages)) {
            logger_1.AppLogger.info(`Creating pipelines for ${selectedPackages.length} packages`);
            try {
                const repoInfo = await (0, utilities_1.getRepositoryInfoFromGit)();
                if (!repoInfo) {
                    logger_1.AppLogger.warn('Could not extract repository info from git remote - permission fetch skipped');
                }
                else {
                    const { owner, repo } = repoInfo;
                    const timestamp = new Date().toISOString();
                    logger_1.AppLogger.info(`Extracted GitHub: owner=${owner}, repo=${repo}`);
                    // Fetch the actual workflow ID from GitHub
                    const accessToken = req.accessToken;
                    let realWorkflowId = '1'; // Fallback to '1' if fetch fails
                    let workflowPath = 'release.yml'; // Default path for reference
                    if (accessToken) {
                        try {
                            logger_1.AppLogger.info(`Fetching workflows for ${owner}/${repo}`);
                            const workflowsResponse = await (0, github_actions_service_1.listWorkflows)(owner, repo, accessToken);
                            // Find the main deployment/release workflow (could be named "Release", "Deployment Workflow", etc.)
                            const releaseWorkflow = workflowsResponse.workflows.find((workflow) => workflow.name === 'Release' ||
                                workflow.name === 'Deployment Workflow' ||
                                workflow.name.toLowerCase().includes('release') ||
                                workflow.name.toLowerCase().includes('deployment'));
                            if (releaseWorkflow) {
                                realWorkflowId = String(releaseWorkflow.id);
                                workflowPath = String(releaseWorkflow.path);
                                logger_1.AppLogger.info(`Found Release workflow with ID: ${realWorkflowId} (name: ${releaseWorkflow.name})`);
                            }
                            else {
                                logger_1.AppLogger.warn(`Release workflow not found. Available workflows: ${workflowsResponse.workflows.map(w => `${w.name}(${w.id})`).join(', ')}`);
                            }
                        }
                        catch (workflowFetchError) {
                            logger_1.AppLogger.warn(`Failed to fetch workflows: ${workflowFetchError}. Using fallback ID 1`);
                        }
                    }
                    else {
                        logger_1.AppLogger.warn('No access token available to fetch workflows');
                    }
                    for (const pkg of selectedPackages) {
                        try {
                            logger_1.AppLogger.info(`Creating pipeline for package: ${pkg.name}`);
                            await pipelineService.createOrUpdatePipeline({
                                releaseVersion: pkg.newVersion,
                                packageName: pkg.name,
                                owner,
                                repo,
                                workflowId: realWorkflowId,
                                workflowName: 'Release',
                                workflowPath: workflowPath,
                                triggerType: 'manual',
                                triggeredBy: authUser?.login || 'unknown',
                                triggeredAt: timestamp,
                                currentStatus: 'queued',
                                currentConclusion: null,
                                lastRunId: undefined,
                            });
                            logger_1.AppLogger.info(`Created pipeline record for package: ${pkg.name}`);
                        }
                        catch (pipelineError) {
                            logger_1.AppLogger.warn(`Failed to create pipeline for ${pkg.name}: ${pipelineError}`);
                            // Don't fail the whole request if pipeline creation fails
                        }
                    }
                }
            }
            catch (configError) {
                logger_1.AppLogger.error(`Failed to read package.json for pipeline creation: ${configError}`);
            }
        }
        else {
            logger_1.AppLogger.warn(`Skipping pipeline creation: selectedPackageNames is ${selectedPackageNames}`);
        }
        res.json({
            success: true,
            message: 'Publishing workflow initiated',
            result: result.result,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to trigger publish: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger publish',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
