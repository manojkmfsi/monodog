import { Request, Response } from 'express';
import { AppLogger } from '../middleware/logger';
import {
  getWorkspacePackages,
  getExistingChangesets,
  calculateNewVersions,
  generateChangeset,
  isWorkingTreeClean,
  triggerPublishPipeline,
  type VersionBump,
  type Package,
} from '../services/changeset-service';
import * as pipelineService from '../services/pipeline-service';
import { getRepositoryInfoFromGit } from '../utils/utilities';
import { listWorkflows } from '../services/github-actions-service';
/**
 * Get all workspace packages
 */
export async function getPublishPackages(req: Request, res: Response) {
  try {
    const rootPath = req.app.locals.rootPath;
    const packages = await getWorkspacePackages(rootPath);

    // Filter out private packages for UI display
    const publicPackages = packages.filter((pkg) => !pkg.private);

    res.json({
      success: true,
      packages: publicPackages,
      total: publicPackages.length,
    });
  } catch (error) {
    AppLogger.error(`Failed to fetch packages: ${error}`);
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
export async function getPublishChangesets(req: Request, res: Response) {
  try {
    const rootPath = req.app.locals.rootPath;
    const changesets = await getExistingChangesets(rootPath);

    res.json({
      success: true,
      changesets,
      total: changesets.length,
    });
  } catch (error) {
    AppLogger.error(`Failed to fetch changesets: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch changesets',
    });
  }
}

/**
 * Preview publish plan (calculate new versions, affected packages)
 */
export async function previewPublish(req: Request, res: Response) {
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
    const allPackages = await getWorkspacePackages(rootPath);

    // Filter selected packages
    const selectedPackages = allPackages.filter((pkg) =>
      selectedPackageNames.includes(pkg.name)
    );

    // Calculate new versions
    const newVersions = calculateNewVersions(selectedPackages, bumps || []);

    // Check if working tree is clean
    const isClean = await isWorkingTreeClean(rootPath);

    // Get existing changesets
    const changesets = await getExistingChangesets(rootPath);

    // Perform validation checks
    const errors: string[] = [];
    const warnings: string[] = [];
    // Get authenticated user
    const authUser = (req as any).user;
    const userPermission = (req as any).permission.permission || 'read';

    // Check 1: Working tree clean
    const workingTreeClean = isClean;
    if (!workingTreeClean) {
      errors.push('Working tree has uncommitted changes');
    }

    // Check 2: User permissions
    const permissionHierarchy: Record<string, number> = {
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

    AppLogger.info(`Publishing preview for user: ${authUser?.login} (permission: ${userPermission})`);

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
  } catch (error) {
    AppLogger.error(`Failed to preview publish: ${error}`);
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
export async function createChangeset(req: Request, res: Response) {
  try {
    const { packages: selectedPackageNames, bumps, summary } = req.body;
    const authUser = (req as any).user;
    const userPermission = (req as any).permission.permission || 'read';

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
    const permissionHierarchy: Record<string, number> = {
      admin: 4,
      maintain: 3,
      write: 2,
      read: 1,
      none: 0,
    };
    const userLevel = permissionHierarchy[userPermission] || 0;
    const requiredLevel = permissionHierarchy['write'] || 0;
    if (userLevel < requiredLevel) {
      AppLogger.warn(`User ${authUser?.login} attempted to create changeset without write permission`);
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `This action requires write permission. You have: ${userPermission}`,
      });
      return;
    }

    const rootPath = req.app.locals.rootPath;

    AppLogger.info(`Creating changeset for user: ${authUser?.login} (permission: ${userPermission})`);

    // Generate the changeset
    const result = await generateChangeset(
      rootPath,
      selectedPackageNames,
      bumps || [],
      summary,
      authUser?.login
    );

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
  } catch (error) {
    AppLogger.error(`Failed to create changeset: ${error}`);
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
export async function checkPublishStatus(req: Request, res: Response) {
  try {
    const rootPath = req.app.locals.rootPath;

    // Check if working tree is clean
    const isClean = await isWorkingTreeClean(rootPath);

    // Get existing changesets
    const changesets = await getExistingChangesets(rootPath);

    res.json({
      success: true,
      status: {
        workingTreeClean: isClean,
        hasChangesets: changesets.length > 0,
        changesetCount: changesets.length,
        readyToPublish: isClean && changesets.length > 0,
      },
    });
  } catch (error) {
    AppLogger.error(`Failed to check publish status: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to check publish status',
    });
  }
}

/**
 * Trigger publishing workflow
 */
export async function triggerPublish(req: Request, res: Response) {
  try {
    const rootPath = req.app.locals.rootPath;
    const authUser = (req as any).user;
    const userPermission = (req as any).permission.permission || 'read';
    const { packages: selectedPackages } = req.body;
    const selectedPackageNames = selectedPackages?.map((pkg: Record<string, string|string[]>) => pkg.name) || [];
    // Check permissions
    const permissionHierarchy: Record<string, number> = {
      admin: 4,
      maintain: 3,
      write: 2,
      read: 1,
      none: 0,
    };
    const userLevel = permissionHierarchy[userPermission] || 0;
    const requiredLevel = permissionHierarchy['maintain'] || 0;
    if (userLevel < requiredLevel) {
      AppLogger.warn(`User ${authUser?.login} attempted to trigger publish without maintain permission`);
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `This action requires maintain permission. You have: ${userPermission}`,
      });
      return;
    }

    // Check if working tree is clean
    const isClean = await isWorkingTreeClean(rootPath);
    if (!isClean) {
      res.status(400).json({
        success: false,
        error: 'Working tree not clean',
        message: 'Please commit or stash all changes before publishing',
      });
      return;
    }

    // Check if changesets exist
    const changesets = await getExistingChangesets(rootPath);
    if (changesets.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No changesets found',
        message: 'Create changesets before publishing',
      });
      return;
    }

    AppLogger.info(`Triggering publish for user: ${authUser?.login} (permission: ${userPermission})`);

    // Trigger publish pipeline with user context and package info
    const result = await triggerPublishPipeline(rootPath, authUser?.login, selectedPackages);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: 'Failed to trigger publish pipeline',
        message: result.message,
      });
      return;
    }

    // Create pipeline records in database for each package
    AppLogger.info(`Checking if should create pipelines: selectedPackageNames=${JSON.stringify(selectedPackageNames)}, isArray=${Array.isArray(selectedPackageNames)}`);

    if (selectedPackages && Array.isArray(selectedPackages)) {
      AppLogger.info(`Creating pipelines for ${selectedPackages.length} packages`);
      try {
        const repoInfo = await getRepositoryInfoFromGit();

        if (!repoInfo) {
          AppLogger.warn('Could not extract repository info from git remote - permission fetch skipped');
        } else {

          const { owner, repo } = repoInfo;

          const timestamp = new Date().toISOString();
          AppLogger.info(`Extracted GitHub: owner=${owner}, repo=${repo}`);

          // Fetch the actual workflow ID from GitHub
          const accessToken = (req as any).accessToken;
          let realWorkflowId = '1'; // Fallback to '1' if fetch fails
          let workflowPath = 'release.yml'; // Default path for reference

          if (accessToken) {
            try {
              AppLogger.info(`Fetching workflows for ${owner}/${repo}`);
              const workflowsResponse = await listWorkflows(owner, repo, accessToken);

              // Find the main deployment/release workflow (could be named "Release", "Deployment Workflow", etc.)
              const releaseWorkflow = workflowsResponse.workflows.find(
                (workflow) =>
                  workflow.name === 'Release' ||
                  workflow.name === 'Deployment Workflow' ||
                  workflow.name.toLowerCase().includes('release') ||
                  workflow.name.toLowerCase().includes('deployment')
              );

              if (releaseWorkflow) {
                realWorkflowId = String(releaseWorkflow.id);
                workflowPath = String(releaseWorkflow.path);
                AppLogger.info(`Found Release workflow with ID: ${realWorkflowId} (name: ${releaseWorkflow.name})`);
              } else {
                AppLogger.warn(`Release workflow not found. Available workflows: ${workflowsResponse.workflows.map(w => `${w.name}(${w.id})`).join(', ')}`);
              }
            } catch (workflowFetchError) {
              AppLogger.warn(`Failed to fetch workflows: ${workflowFetchError}. Using fallback ID 1`);
            }
          } else {
            AppLogger.warn('No access token available to fetch workflows');
          }

          for (const pkg of selectedPackages) {
            try {
              AppLogger.info(`Creating pipeline for package: ${pkg.name}`);
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
              AppLogger.info(`Created pipeline record for package: ${pkg.name}`);
            } catch (pipelineError) {
              AppLogger.warn(`Failed to create pipeline for ${pkg.name}: ${pipelineError}`);
              // Don't fail the whole request if pipeline creation fails
            }
          }
        }
      } catch (configError) {
        AppLogger.error(`Failed to read package.json for pipeline creation: ${configError}`);
      }
    } else {
      AppLogger.warn(`Skipping pipeline creation: selectedPackageNames is ${selectedPackageNames}`);
    }

    res.json({
      success: true,
      message: 'Publishing workflow initiated',
      result: result.result,
    });
  } catch (error) {
    AppLogger.error(`Failed to trigger publish: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger publish',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
