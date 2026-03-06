/**
 * Publish Controller
 * Orchestrates the independent release process
 * Coordinates: change detection, versioning, readiness, and publishing
 */

import {
  PublishRunner,
  PublishRunnerFactory,
  PublishRunnerConfig,
  PublishRunnerResult,
} from './publish-runners';
import { changeTrackerService } from './change-tracker-service';
import { releaseReadinessService } from './release-readiness-service';
import { npmPublishService } from './npm-publish-service';
import { secureTokenService } from './secure-token-service';
import { changelogGenerator } from './changelog-generator';
import fs from 'fs';
import path from 'path';
import { publishPipelineService } from './publish-pipeline-service';
export interface PublishRequest {
  packageNames: string[];
  packagePaths: Record<string, string>;
  versionMap?: Record<string, string>;
  method?: 'node' | 'github-actions' | 'auto';
  dryRun?: boolean;
  autoTag?: boolean;
  createReleases?: boolean;
  userId?: string;
}

export interface PublishPipelineStatus {
  pipelineId: string;
  status:
    | 'pending'
    | 'validating'
    | 'ready'
    | 'publishing'
    | 'completed'
    | 'failed';
  progress: number;
  packagesToPublish: string[];
  results: Record<string, PublishRunnerResult>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export class PublishController {
  private pipelines: Map<string, PublishPipelineStatus> = new Map();

  /**
   * Validate and prepare packages for publishing
   */
  async preparePublish(request: PublishRequest): Promise<{
    valid: boolean;
    readiness: any;
    analysis: any;
  }> {
    console.info(
      `🔍 Preparing publish for: ${request.packageNames.join(', ')}`
    );

    try {
      // 1. Get readiness status for all packages
      const packages = request.packageNames.map(name => ({
        name,
        path: request.packagePaths[name],
        currentVersion: this.getCurrentVersion(
          name,
          request.packagePaths[name]
        ),
      }));

      const readiness =
        await releaseReadinessService.checkReleaseReadiness(packages);

      // 2. Analyze changes for each package
      const analysis: Record<string, any> = {};
      for (const pkg of packages) {
        try {
          const changes = await changeTrackerService.analyzeChanges(
            pkg.name,
            pkg.path,
            pkg.currentVersion,
            ''
          );
          analysis[pkg.name] = changes;
        } catch (error) {
          console.error(`Failed to analyze ${pkg.name}:`, error);
        }
      }

      // 3. Print readiness report
      releaseReadinessService.printReadinessReport(readiness);

      return {
        valid: readiness.canProceed,
        readiness,
        analysis,
      };
    } catch (error) {
      console.error('Failed to prepare publish:', error);
      throw error;
    }
  }

  /**
   * Publish packages to npm
   */
  async publish(request: PublishRequest): Promise<PublishPipelineStatus> {
    const pipelineId = this.generatePipelineId();
    // Create pipeline in DB
    const pipelineRecord = await publishPipelineService.createPipeline({
      id: pipelineId,
      packageNames: JSON.stringify(request.packageNames),
      method: request.method || 'auto',
      status: 'pending',
      triggeredBy: request.userId || 'system',
      triggeredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      releaseVersion: request.versionMap
        ? Object.values(request.versionMap).join(',')
        : undefined,
      releaseNotes: undefined, // Could be set if changelog is generated
      conclusion: undefined,
      completedAt: undefined,
      errorMessage: undefined,
      errorDetails: undefined,
    });

    const status: PublishPipelineStatus = {
      pipelineId,
      status: 'pending',
      progress: 0,
      packagesToPublish: request.packageNames,
      results: {},
    };
    this.pipelines.set(pipelineId, status);

    try {
      status.startedAt = new Date().toISOString();
      status.status = 'validating';
      await publishPipelineService.updatePipeline(pipelineId, {
        status: 'validating',
        updatedAt: new Date(),
      });

      // 1. Get readiness
      const prep = await this.preparePublish(request);
      if (!prep.valid && !request.dryRun) {
        await publishPipelineService.updatePipeline(pipelineId, {
          status: 'failed',
          updatedAt: new Date(),
        });
        throw new Error(
          `Packages not ready for publishing. Fix blockers and try again.`
        );
      }

      status.status = 'ready';
      status.progress = 20;
      await publishPipelineService.updatePipeline(pipelineId, {
        status: 'ready',
        updatedAt: new Date(),
      });

      // 2. Get credentials
      const npmToken = await secureTokenService.getToken('npm', 'env');
      const githubToken =
        request.method !== 'node'
          ? await secureTokenService.getToken('github', 'env')
          : undefined;

      // 3. Publish each package
      status.status = 'publishing';
      await publishPipelineService.updatePipeline(pipelineId, {
        status: 'publishing',
        updatedAt: new Date(),
      });
      const publisherCount = request.packageNames.length;

      for (let i = 0; i < request.packageNames.length; i++) {
        const packageName = request.packageNames[i];
        const packagePath = request.packagePaths[packageName];

        console.info(
          `\n📦 Publishing ${i + 1}/${publisherCount}: ${packageName}`
        );

        // Get pre-publish version
        const prePublishVersion = this.getCurrentVersion(
          packageName,
          packagePath
        );

        const result = await this.publishPackage(
          packageName,
          packagePath,
          request.versionMap?.[packageName],
          npmToken,
          githubToken,
          request
        );

        // Get new version from package.json after publish (in case publish step bumps it)
        const postPublishVersion = this.getCurrentVersion(
          packageName,
          packagePath
        );

        status.results[packageName] = result;
        status.progress = 20 + ((i + 1) / publisherCount) * 80;

        // Store result in DB
        await publishPipelineService.addPublishResult(pipelineId, {
          packageName,
          currentVersion: prePublishVersion,
          newVersion: postPublishVersion,
          status: result.success ? 'completed' : 'failed',
          result: result.success ? 'published' : 'error',
          error: result.errors?.join('\n') || undefined,
          errorDetails: result.errors?.join('\n') || undefined,
          npmPackageId: result.packageId,
          publishedAt: result.success ? new Date() : undefined,
          // tarballUrl: result.tarballUrl || undefined, // Not present in result
          gitTagCreated: result.gitTag || undefined,
          // gitCommitSha: result.gitCommitSha || undefined, // Not present in result
          // gitPushCompleted: result.gitPushCompleted || false, // Not present in result
          githubReleaseUrl: result.gitHubReleaseUrl || undefined,
        });
      }

      // 4. Generate changelog entries
      if (!request.dryRun) {
        console.info('\n📝 Generating changelogs...');
        await this.generateChangelogs(
          request.packageNames,
          request.packagePaths,
          status.results
        );
      }

      status.status = 'completed';
      status.progress = 100;
      status.completedAt = new Date().toISOString();
      await publishPipelineService.updatePipeline(pipelineId, {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        conclusion: 'success',
        errorMessage: undefined,
        errorDetails: undefined,
      });

      console.info(`\n✅ Publish pipeline completed: ${pipelineId}`);
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
      status.completedAt = new Date().toISOString();
      await publishPipelineService.updatePipeline(pipelineId, {
        status: 'failed',
        errorMessage: status.error,
        errorDetails: status.error,
        completedAt: new Date(),
        updatedAt: new Date(),
        conclusion: 'failure',
      });
      console.error(`\n❌ Publish pipeline failed: ${status.error}`);
    }

    return status;
  }

  /**
   * Publish a single package
   */
  private async publishPackage(
    packageName: string,
    packagePath: string,
    proposedVersion?: string,
    npmToken?: string,
    githubToken?: string,
    request?: PublishRequest
  ): Promise<PublishRunnerResult> {
    try {
      // Determine runner
      const method = request?.method || 'auto';
      const runner = PublishRunnerFactory.createRunner(
        method === 'auto' ? undefined : method,
        githubToken
      );

      // Get current version
      const currentVersion = this.getCurrentVersion(packageName, packagePath);

      // Prepare config
      const config: PublishRunnerConfig = {
        packageName,
        packagePath,
        currentVersion,
        proposedVersion,
        npmToken: npmToken || '',
        githubToken,
        dryRun: request?.dryRun,
        gitTag: request?.autoTag !== false,
        createGitHubRelease: request?.createReleases,
      };

      // Run publisher
      const result = await runner.run(config);

      // Log result
      if (result.success) {
        console.info(`✅ Published: ${result.packageId}@${result.version}`);
      } else {
        console.error(`❌ Failed: ${result.packageId}`);
        result.errors.forEach(e => console.error(`   ${e}`));
      }

      return result;
    } catch (error) {
      console.error(`Error publishing ${packageName}:`, error);
      return {
        success: false,
        packageId: packageName,
        version: '',
        method: 'node',
        npmUrl: '',
        timestamp: new Date().toISOString(),
        logs: [],
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Generate changelog entries for published packages
   */
  private async generateChangelogs(
    packageNames: string[],
    packagePaths: Record<string, string>,
    results: Record<string, PublishRunnerResult>
  ): Promise<void> {
    // Collect changelog data for all successful packages, including commit history
    const packages: Array<{
      name: string;
      path: string;
      newVersion: string;
      previousVersion: string | null;
      commits: any[];
    }> = [];
    for (const packageName of packageNames) {
      const result = results[packageName];
      if (!result?.success) continue;
      const packagePath = packagePaths[packageName];

      // Get previous version from package.json before publish (optional: could be stored earlier)
      // For now, set to null to let changelog generator handle first release
      let previousVersion: string | null = null;
      try {
        const pkgJsonPath = path.join(packagePath, 'package.json');
        const content = fs.readFileSync(pkgJsonPath, 'utf8');
        const pkgJson = JSON.parse(content);
        previousVersion = pkgJson.version || null;
      } catch (e) {
        // ignore error reading previous version
      }

      // Get commit history for this package since last tag
      let commits: any[] = [];
      try {
        // Use changeTrackerService to get commits since last tag
        const lastTag = `${packageName}@${previousVersion || result.version}`;
        commits = await changeTrackerService.getCommitsSinceTag(
          lastTag,
          packagePath
        );
      } catch (e) {
        console.warn(`Could not get commits for ${packageName}:`, e);
      }

      packages.push({
        name: packageName,
        path: packagePath,
        newVersion: result.version,
        previousVersion,
        commits,
      });
    }

    if (packages.length === 0) return;

    // Generate changelog entries for all packages
    const entries = await changelogGenerator.generateMultiple(packages);

    // Write per-package changelogs
    for (const pkg of packages) {
      const entry = entries.get(pkg.name);
      if (entry) {
        await changelogGenerator.appendToChangelog(pkg.path, entry, pkg.name);
        console.info(`  Updated CHANGELOG.md for ${pkg.name}`);
      }
    }

    // Write monorepo changelog
    const outputPath = path.join(process.cwd(), 'MONOREPO_CHANGELOG.md');
    await changelogGenerator.generateMonorepoChangelog(entries, outputPath);
    console.info(`  Monorepo changelog generated at ${outputPath}`);
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(pipelineId: string): PublishPipelineStatus | undefined {
    return this.pipelines.get(pipelineId);
  }

  /**
   * Get all pipelines
   */
  getAllPipelines(): PublishPipelineStatus[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Get detailed pipeline information
   */
  async getPipelineDetails(pipelineId: string): Promise<any> {
    const status = this.pipelines.get(pipelineId);
    if (!status) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    return {
      ...status,
      packages: status.packagesToPublish.map(name => ({
        name,
        result: status.results[name],
      })),
    };
  }

  /**
   * Cancel a publishing pipeline
   */
  async cancelPipeline(pipelineId: string): Promise<void> {
    const status = this.pipelines.get(pipelineId);
    if (!status) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      throw new Error(`Cannot cancel ${status.status} pipeline`);
    }

    status.status = 'failed';
    status.error = 'Cancelled by user';
    status.completedAt = new Date().toISOString();

    console.info(`Cancelled pipeline: ${pipelineId}`);
  }

  /**
   * Get current version from package.json
   */
  private getCurrentVersion(packageName: string, packagePath: string): string {
    try {
      const pkgJsonPath = path.join(packagePath, 'package.json');
      const content = fs.readFileSync(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(content);
      return pkgJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Generate unique pipeline ID
   */
  private generatePipelineId(): string {
    return `publish-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const publishController = new PublishController();
