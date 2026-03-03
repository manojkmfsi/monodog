/**
 * Release API Routes
 * HTTP endpoints for the independent release system
 * Exposes change detection, readiness checks, and publishing operations
 */

import { Router, Request, Response } from 'express';
import { publishController } from '../services/publish-controller';
import { releaseReadinessService } from '../services/release-readiness-service';
import { changeTrackerService } from '../services/change-tracker-service';
import { npmPublishService } from '../services/npm-publish-service';

const router = Router();

/**
 * GET /api/releases/packages
 * Get list of packages available in workspace
 */
router.get('/packages', async (req: Request, res: Response) => {
  try {
    const packages = publishController.getAvailablePackages(process.cwd());

    res.json({
      success: true,
      packages,
      count: packages.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/releases/analyze
 * Analyze changes for packages without publishing
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { packageNames, packagePaths } = req.body;

    if (!packageNames || !packagePaths) {
      return res.status(400).json({
        success: false,
        error: 'Missing packageNames or packagePaths',
      });
    }

    const analysis: Record<string, any> = {};

    for (const packageName of packageNames) {
      try {
        const packagePath = packagePaths[packageName];
        const currentVersion = getCurrentVersion(packageName, packagePath);

        const changes = await changeTrackerService.analyzeChanges(
          packageName,
          packagePath,
          currentVersion,
          ''
        );

        analysis[packageName] = changes;
      } catch (error) {
        analysis[packageName] = {
          error: error instanceof Error ? error.message : 'Analysis failed',
        };
      }
    }

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * POST /api/releases/check-readiness
 * Check if packages are ready for publishing
 */
router.post('/check-readiness', async (req: Request, res: Response) => {
  try {
    const { packageNames, packagePaths } = req.body;

    if (!packageNames || !packagePaths) {
      return res.status(400).json({
        success: false,
        error: 'Missing packageNames or packagePaths',
      });
    }

    const packages = packageNames.map((name: string) => ({
      name,
      path: packagePaths[name],
      currentVersion: getCurrentVersion(name, packagePaths[name]),
    }));

    const readiness = await releaseReadinessService.checkReleaseReadiness(packages);

    res.json({
      success: true,
      canProceed: readiness.canProceed,
      summary: readiness.summary,
      checks: readiness.allChecks,
      globalBlockers: readiness.globalBlockers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Readiness check failed',
    });
  }
});

/**
 * POST /api/releases/prepare
 * Prepare packages for publishing (validate and analyze)
 */
router.post('/prepare', async (req: Request, res: Response) => {
  try {
    const { packageNames, packagePaths, dryRun = false } = req.body;

    if (!packageNames || !packagePaths) {
      return res.status(400).json({
        success: false,
        error: 'Missing packageNames or packagePaths',
      });
    }

    const result = await publishController.preparePublish({
      packageNames,
      packagePaths,
      dryRun,
    });

    res.json({
      success: result.valid,
      canProceed: result.valid,
      readiness: result.readiness,
      analysis: result.analysis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Preparation failed',
    });
  }
});

/**
 * GET /api/releases/status/:pipelineId
 * Get status of a publish pipeline
 */
router.get('/status/:pipelineId', async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;
    const status = publishController.getPipelineStatus(pipelineId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: `Pipeline not found: ${pipelineId}`,
      });
    }

    res.json({
      success: true,
      pipeline: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * GET /api/releases/details/:pipelineId
 * Get detailed information about a pipeline
 */
router.get('/details/:pipelineId', async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;
    const details = await publishController.getPipelineDetails(pipelineId);

    res.json({
      success: true,
      details,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Pipeline not found',
    });
  }
});

/**
 * GET /api/releases/pipelines
 * Get all pipelines (with optional filtering)
 */
router.get('/pipelines', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query;

    let pipelines = publishController.getAllPipelines();

    if (status) {
      pipelines = pipelines.filter(p => p.status === status);
    }

    pipelines = pipelines.slice(0, Number(limit));

    res.json({
      success: true,
      pipelines,
      count: pipelines.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list pipelines',
    });
  }
});

/**
 * POST /api/releases/start
 * Start a new publish pipeline
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const {
      packageNames,
      packagePaths,
      versionMap,
      method = 'auto',
      dryRun = false,
      autoTag = true,
      createReleases = false,
    } = req.body;

    if (!packageNames || !packagePaths) {
      return res.status(400).json({
        success: false,
        error: 'Missing packageNames or packagePaths',
      });
    }

    console.info(`📦 Starting publish pipeline for: ${packageNames.join(', ')}`);

    const pipeline = await publishController.publish({
      packageNames,
      packagePaths,
      versionMap,
      method,
      dryRun,
      autoTag,
      createReleases,
    });

    res.status(201).json({
      success: pipeline.status !== 'failed',
      pipeline,
      pipelineId: pipeline.pipelineId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start publish',
    });
  }
});

/**
 * POST /api/releases/cancel/:pipelineId
 * Cancel a publishing pipeline
 */
router.post('/cancel/:pipelineId', async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;

    await publishController.cancelPipeline(pipelineId);

    res.json({
      success: true,
      message: `Pipeline ${pipelineId} cancelled`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel pipeline',
    });
  }
});

/**
 * GET /api/releases/npm/:packageName/versions
 * Get published versions for a package
 */
router.get('/npm/:packageName/versions', async (req: Request, res: Response) => {
  try {
    const { packageName } = req.params;

    const versions = await npmPublishService.getPublishedVersions(packageName);

    res.json({
      success: true,
      packageName,
      versions,
      count: versions.length,
      latest: versions[0] || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get versions',
    });
  }
});

/**
 * GET /api/releases/npm/:packageName/:version/available
 * Check if a version is available on npm
 */
router.get('/npm/:packageName/:version/available', async (req: Request, res: Response) => {
  try {
    const { packageName, version } = req.params;

    const available = await npmPublishService.isVersionAvailable(packageName, version);

    res.json({
      success: true,
      packageName,
      version,
      available,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check version',
    });
  }
});

/**
 * GET /api/releases/health
 * Health check for release system
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const pipelines = publishController.getAllPipelines();
    const activePipelines = pipelines.filter(
      p => p.status === 'publishing' || p.status === 'validating'
    );

    res.json({
      success: true,
      status: 'healthy',
      activePipelines: activePipelines.length,
      totalPipelines: pipelines.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Release system health check failed',
    });
  }
});

/**
 * Helper function to get current version
 */
function getCurrentVersion(packageName: string, packagePath: string): string {
  try {
    const fs = require('fs');
    const path = require('path');
    const pkgJsonPath = path.join(packagePath, 'package.json');
    const content = fs.readFileSync(pkgJsonPath, 'utf8');
    const pkgJson = JSON.parse(content);
    return pkgJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default router;
