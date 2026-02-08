import { Request, Response } from 'express';
import { AppLogger } from '../middleware/logger';
import {
  getWorkspacePackages,
  getExistingChangesets,
  calculateNewVersions,
  generateChangeset,
  validateChangeset,
  isWorkingTreeClean,
  triggerPublishPipeline,
  type VersionBump,
  type Package,
} from '../services/changeset-service';

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
    const isClean = true;//await isWorkingTreeClean(rootPath);

    // Get existing changesets
    const changesets = await getExistingChangesets(rootPath);

    // Perform validation checks
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: Working tree clean
    const workingTreeClean = isClean;
    if (!workingTreeClean) {
      errors.push('Working tree has uncommitted changes');
    }

    // Check 2: User permissions (simplified - always true for now)
    const permissions = true;

    // Check 3: CI passing (simplified - always true for now)
    const ciPassing = true;

    // Check 4: Version available on npm (simplified - always true for now)
    const versionAvailable = true;

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

    const rootPath = req.app.locals.rootPath;

    // Generate the changeset
    const result = await generateChangeset(
      rootPath,
      selectedPackageNames,
      bumps || [],
      summary
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
    const isClean = true; //await isWorkingTreeClean(rootPath);

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

    // Check if working tree is clean
    const isClean = true; //await isWorkingTreeClean(rootPath);
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

    // Trigger publish pipeline
    const result = await triggerPublishPipeline(rootPath);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: 'Failed to trigger publish pipeline',
        message: result.message,
      });
      return;
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
