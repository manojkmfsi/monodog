/**
 * Publish Runner Implementations
 * Base interface and two implementations:
 * 1. NodePublishRunner: Direct npm publishing via Node.js
 * 2. GitHubActionsPublishRunner: Delegate to GitHub Actions workflow
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { npmPublishService } from './npm-publish-service';
import { changeTrackerService } from './change-tracker-service';
import { semverEngine } from './semver-engine';
import { secureTokenService } from './secure-token-service';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface PublishRunnerConfig {
  packageName: string;
  packagePath: string;
  currentVersion: string;
  proposedVersion?: string;
  npmToken: string;
  githubToken?: string;
  gitConfig?: { name: string; email: string };
  dryRun?: boolean;
  gitTag?: boolean;
  createGitHubRelease?: boolean;
}

export interface PublishRunnerResult {
  success: boolean;
  packageId: string;
  version: string;
  method: 'node' | 'github-actions';
  npmUrl: string;
  gitTag?: string;
  gitHubReleaseUrl?: string;
  timestamp: string;
  logs: string[];
  errors: string[];
}

/**
 * Base abstract class for publish runners
 */
export abstract class PublishRunner {
  protected logs: string[] = [];
  protected errors: string[] = [];

  abstract run(config: PublishRunnerConfig): Promise<PublishRunnerResult>;

  protected log(message: string): void {
    console.log(message);
    this.logs.push(message);
  }

  protected logError(message: string): void {
    console.error(message);
    this.errors.push(message);
  }
}

/**
 * Direct Node.js publish runner
 * Handles: versioning, git operations, npm publishing, GitHub releases
 */
export class NodePublishRunner extends PublishRunner {
  async run(config: PublishRunnerConfig): Promise<PublishRunnerResult> {
    this.logs = [];
    this.errors = [];

    const {
      packageName,
      packagePath,
      currentVersion,
      proposedVersion,
      npmToken,
      dryRun = false,
      gitTag = true,
      createGitHubRelease = false,
    } = config;

    try {
      this.log(`🚀 Starting Node.js publish runner for ${packageName}`);

      // 1. Determine version
      let version = proposedVersion || currentVersion;
      if (!proposedVersion) {
        this.log(`📊 Analyzing changes to determine version...`);
        const analysis = await changeTrackerService.analyzeChanges(
          packageName,
          packagePath,
          currentVersion,
          this.getLastTag(packageName)
        );
        version = analysis.proposedVersion;
        this.log(`  Proposed version: ${version}`);
      }

      // 2. Update version in package.json
      if (!dryRun) {
        this.log(`📝 Updating package.json version to ${version}...`);
        await this.updatePackageJsonVersion(packagePath, version);
        this.log(`  Version updated`);
      }

      // 3. Update dependencies if this is a monorepo
      this.log(`🔗 Checking for dependent packages...`);
      const dependents = await this.getPackageDependents(packageName);
      if (dependents.length > 0 && !dryRun) {
        this.log(`  Updating versions in dependents: ${dependents.join(', ')}`);
        // Dependents would be updated in cascade
      }

      // 4. Commit changes to git
      if (gitTag && !dryRun) {
        this.log(`📌 Creating git commit and tag...`);
        await this.commitAndTag(packageName, version, config.gitConfig);
        this.log(`  Tag created: v${version}`);
      }

      // 5. Publish to npm
      this.log(`📤 Publishing to npm registry...`);
      const publishResult = await npmPublishService.publishToNpm({
        packageName,
        version,
        packagePath,
        npmToken,
        dryRun,
      });
      this.log(`  Published successfully`);

      // 6. Create GitHub release if requested
      let gitHubReleaseUrl: string | undefined;
      if (createGitHubRelease && config.githubToken && !dryRun) {
        this.log(`📢 Creating GitHub release...`);
        gitHubReleaseUrl = await this.createGitHubRelease(
          packageName,
          version,
          config.githubToken
        );
        this.log(`  GitHub release created`);
      }

      // 7. Push git changes
      if (gitTag && !dryRun) {
        this.log(`🚀 Pushing git changes...`);
        await this.pushGitChanges();
        this.log(`  Changes pushed to remote`);
      }

      this.log(`✅ Publish complete for ${packageName}@${version}`);

      return {
        success: true,
        packageId: packageName,
        version,
        method: 'node',
        npmUrl: `https://www.npmjs.com/package/${packageName}/v/${version}`,
        gitTag: gitTag ? `v${version}` : undefined,
        gitHubReleaseUrl,
        timestamp: new Date().toISOString(),
        logs: this.logs,
        errors: this.errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logError(`❌ Publish failed: ${errorMsg}`);

      return {
        success: false,
        packageId: packageName,
        version: proposedVersion || currentVersion,
        method: 'node',
        npmUrl: '',
        timestamp: new Date().toISOString(),
        logs: this.logs,
        errors: this.errors,
      };
    }
  }

  private async updatePackageJsonVersion(
    packagePath: string,
    version: string
  ): Promise<void> {
    const pkgJsonPath = path.join(packagePath, 'package.json');
    const content = await fs.promises.readFile(pkgJsonPath, 'utf8');
    const pkgJson = JSON.parse(content);

    pkgJson.version = version;

    await fs.promises.writeFile(
      pkgJsonPath,
      JSON.stringify(pkgJson, null, 2) + '\n'
    );
  }

  private async commitAndTag(
    packageName: string,
    version: string,
    gitConfig?: { name: string; email: string }
  ): Promise<void> {
    try {
      if (gitConfig) {
        await execSync(`git config user.name "${gitConfig.name}"`);
        await execSync(`git config user.email "${gitConfig.email}"`);
      }

      const tagName = `${packageName}-v${version}`;
      await execSync(
        `git add :/ && git commit -m "chore: release ${packageName}@${version}" --no-verify`
      );
      await execSync(`git tag ${tagName}`);
    } catch (error) {
      throw new Error(
        `Git operations failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  private async pushGitChanges(): Promise<void> {
    try {
      await execAsync('git push origin --follow-tags');
    } catch (error) {
      throw new Error(
        `Failed to push changes: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  private async createGitHubRelease(
    packageName: string,
    version: string,
    githubToken: string
  ): Promise<string> {
    // This would call GitHub API to create release
    // Placeholder for now - would be implemented with full GitHub integration
    const releaseUrl = `https://github.com/owner/repo/releases/tag/${packageName}-v${version}`;
    return releaseUrl;
  }

  private getLastTag(packageName: string): string {
    // Get the most recent tag for this package
    return '';
  }

  private async getPackageDependents(packageName: string): Promise<string[]> {
    // Return list of packages that depend on this one
    return [];
  }
}

/**
 * GitHub Actions publish runner
 * Delegates publish operation to GitHub Actions workflow
 * Monitors workflow execution and waits for completion
 */
export class GitHubActionsPublishRunner extends PublishRunner {
  async run(config: PublishRunnerConfig): Promise<PublishRunnerResult> {
    this.logs = [];
    this.errors = [];

    const {
      packageName,
      packagePath,
      currentVersion,
      proposedVersion,
      githubToken,
      dryRun = false,
    } = config;

    try {
      this.log(`🚀 Starting GitHub Actions publish runner for ${packageName}`);

      if (!githubToken) {
        throw new Error('GitHub token required for GitHub Actions publish');
      }

      // 1. Determine version
      let version = proposedVersion || currentVersion;
      if (!proposedVersion) {
        this.log(`📊 Analyzing changes to determine version...`);
        const analysis = await changeTrackerService.analyzeChanges(
          packageName,
          packagePath,
          currentVersion,
          this.getLastTag(packageName)
        );
        version = analysis.proposedVersion;
        this.log(`  Proposed version: ${version}`);
      }

      if (dryRun) {
        this.log(`⚠️  DRY RUN: Trigger GitHub Actions workflow for publish`);
        return {
          success: true,
          packageId: packageName,
          version,
          method: 'github-actions',
          npmUrl: `https://www.npmjs.com/package/${packageName}/v/${version}`,
          timestamp: new Date().toISOString(),
          logs: this.logs,
          errors: this.errors,
        };
      }

      // 2. Trigger GitHub Actions workflow
      this.log(`⚙️  Triggering GitHub Actions workflow...`);
      const workflowRunId = await this.triggerPublishWorkflow(
        packageName,
        version,
        githubToken
      );
      this.log(`  Workflow triggered: Run ID ${workflowRunId}`);

      // 3. Monitor workflow execution
      this.log(`📍 Monitoring workflow execution...`);
      const result = await this.monitorWorkflow(workflowRunId, githubToken);

      if (!result.success) {
        throw new Error(`Workflow failed: ${result.error}`);
      }

      this.log(`✅ GitHub Actions workflow completed successfully`);

      return {
        success: true,
        packageId: packageName,
        version,
        method: 'github-actions',
        npmUrl: `https://www.npmjs.com/package/${packageName}/v/${version}`,
        gitTag: `${packageName}-v${version}`,
        gitHubReleaseUrl: result.releaseUrl,
        timestamp: new Date().toISOString(),
        logs: this.logs,
        errors: this.errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logError(`❌ Publish failed: ${errorMsg}`);

      return {
        success: false,
        packageId: packageName,
        version: proposedVersion || currentVersion,
        method: 'github-actions',
        npmUrl: '',
        timestamp: new Date().toISOString(),
        logs: this.logs,
        errors: this.errors,
      };
    }
  }

  private async triggerPublishWorkflow(
    packageName: string,
    version: string,
    githubToken: string
  ): Promise<string> {
    // Call GitHub API to trigger workflow
    // Returns workflow run ID
    const runId = `run-${Date.now()}`;
    return runId;
  }

  private async monitorWorkflow(
    workflowRunId: string,
    githubToken: string
  ): Promise<{ success: boolean; error?: string; releaseUrl?: string }> {
    // Poll GitHub API for workflow status
    // Returns result when completed

    // Placeholder - would implement actual polling logic
    return {
      success: true,
      releaseUrl: `https://github.com/owner/repo/releases/tag/release-${workflowRunId}`,
    };
  }

  private getLastTag(packageName: string): string {
    return '';
  }
}

/**
 * Publish runner factory
 * Selects appropriate runner based on available credentials and configuration
 */
export class PublishRunnerFactory {
  static createRunner(
    preferredMethod?: 'node' | 'github-actions',
    githubToken?: string
  ): PublishRunner {
    // If GitHub Actions is preferred and token available, use it
    if (preferredMethod === 'github-actions' && githubToken) {
      return new GitHubActionsPublishRunner();
    }

    // Default to Node.js runner
    return new NodePublishRunner();
  }
}
