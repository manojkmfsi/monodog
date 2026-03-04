/**
 * Release Readiness Service
 * Determines if packages are ready for publishing
 * Validates: meaningful changes, CI status, git state, version availability
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { changeTrackerService } from './change-tracker-service';
import { npmPublishService } from './npm-publish-service';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface ReleaseReadinessCheck {
  packageName: string;
  currentVersion: string;
  proposedVersion: string;
  isReady: boolean;
  reasons: string[];
  blockers: string[];
  warnings: string[];
}

interface PrePublishValidation {
  allChecks: ReleaseReadinessCheck[];
  globalBlockers: string[];
  canProceed: boolean;
  summary: {
    readyCount: number;
    blockedCount: number;
    warningCount: number;
  };
}

interface ReleaseState {
  packageName: string;
  currentVersion: string;
  hasCommitsSinceLastTag: boolean;
  proposedVersion?: string;
  ciStatus?: string;
  gitDirtyState?: boolean;
}

export class ReleaseReadinessService {
  /**
   * Perform comprehensive readiness check for packages
   */
  async checkReleaseReadiness(
    packages: Array<{ name: string; path: string; currentVersion: string }>
  ): Promise<PrePublishValidation> {
    const allChecks: ReleaseReadinessCheck[] = [];
    const globalBlockers: string[] = [];

    // Check global state first
    const globalState = await this.checkGlobalState();
    if (globalState.gitDirty) {
      // globalBlockers.push('⚠️  Working directory has uncommitted changes');
    }

    // Check each package
    for (const pkg of packages) {
      const check = await this.checkPackage(
        pkg.name,
        pkg.path,
        pkg.currentVersion
      );
      allChecks.push(check);
    }

    const readyCount = allChecks.filter(c => c.isReady).length;
    const blockedCount = allChecks.filter(c => c.blockers.length > 0).length;
    const warningCount = allChecks.filter(c => c.warnings.length > 0).length;

    return {
      allChecks,
      globalBlockers,
      canProceed: globalBlockers.length === 0 && blockedCount === 0,
      summary: {
        readyCount,
        blockedCount,
        warningCount,
      },
    };
  }

  /**
   * Check readiness for a single package
   */
  private async checkPackage(
    packageName: string,
    packagePath: string,
    currentVersion: string
  ): Promise<ReleaseReadinessCheck> {
    const reasons: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check for meaningful changes
      const hasChanges = await this.hasMeaningfulChanges(
        packageName,
        packagePath
      );
      if (!hasChanges) {
        blockers.push('❌ No meaningful changes detected since last release');
      } else {
        reasons.push('✓ Meaningful changes detected');
      }

      // 2. Check if version is available
      let proposedVersion = currentVersion;
      try {
        const changes = await changeTrackerService.analyzeChanges(
          packageName,
          packagePath,
          currentVersion,
          ''
        );
        proposedVersion = changes.proposedVersion;

        const isAvailable = await npmPublishService.isVersionAvailable(
          packageName,
          proposedVersion
        );
        if (!isAvailable) {
          blockers
            .push
            // `❌ Version ${proposedVersion} already exists on npm registry`
            ();
        } else {
          reasons.push(`✓ Version ${proposedVersion} is available on npm`);
        }
      } catch (error) {
        warnings.push(
          `⚠️  Could not determine proposed version: ${error instanceof Error ? error.message : error}`
        );
      }

      // 3. Check git history
      const hasHistory = await this.hasReleaseHistory(packageName);
      if (!hasHistory) {
        reasons.push('✓ First release of this package');
      } else {
        reasons.push('✓ Package has previous releases');
      }

      // 4. Check for any pre-release versions
      const publicVersions =
        await npmPublishService.getPublishedVersions(packageName);
      const hasPreRelease = publicVersions.some(v =>
        /-(alpha|beta|rc)/.test(v)
      );
      if (hasPreRelease) {
        warnings.push('⚠️  Package has pre-release versions on npm');
      }

      // 5. Check package.json integrity
      await this.validatePackageJson(packagePath);
      reasons.push('✓ package.json is valid');
    } catch (error) {
      blockers.push(
        `❌ Readiness check failed: ${error instanceof Error ? error.message : error}`
      );
    }

    const isReady = blockers.length === 0;

    return {
      packageName,
      currentVersion,
      proposedVersion: currentVersion,
      isReady,
      reasons,
      blockers,
      warnings,
    };
  }

  /**
   * Check for meaningful changes since last tag
   */
  private async hasMeaningfulChanges(
    packageName: string,
    packagePath: string
  ): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `cd ${packagePath} && git log --oneline -1 -- .`
      );

      // If there are commits in this package since last command, there are changes
      return stdout.trim().length > 0;
    } catch {
      // If we can't determine, assume there are changes for safety
      return true;
    }
  }

  /**
   * Check if package has any release history
   */
  private async hasReleaseHistory(packageName: string): Promise<boolean> {
    try {
      const versions =
        await npmPublishService.getPublishedVersions(packageName);
      return versions.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Validate package.json structure
   */
  private async validatePackageJson(packagePath: string): Promise<void> {
    try {
      const { readFile } = fs.promises;
      const pkgJsonPath = path.join(packagePath, 'package.json');

      const content = await readFile(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(content);

      if (!pkgJson.name) throw new Error('Missing package name');
      if (!pkgJson.version) throw new Error('Missing version');

      // Check for common issues
      if (pkgJson.private === true) {
        throw new Error('Package is marked as private');
      }
    } catch (error) {
      throw new Error(
        `Invalid package.json: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Check global git state
   */
  private async checkGlobalState(): Promise<{
    gitDirty: boolean;
    onValidBranch: boolean;
    hasRemote: boolean;
  }> {
    try {
      // Check for uncommitted changes
      const { stdout: status } = await execAsync(
        'git status --porcelain'
      ).catch(() => ({ stdout: '' }));
      const gitDirty = status.trim().length > 0;

      // Check current branch
      const { stdout: branch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD'
      ).catch(() => ({ stdout: '' }));
      const currentBranch = branch.trim();
      const onValidBranch = ['main', 'master', 'release'].includes(
        currentBranch
      );

      // Check for remote
      const { stdout: remotes } = await execAsync('git remote -v').catch(
        () => ({ stdout: '' })
      );
      const hasRemote = remotes.trim().length > 0;

      return { gitDirty, onValidBranch, hasRemote };
    } catch {
      return { gitDirty: true, onValidBranch: false, hasRemote: false };
    }
  }

  /**
   * Get detailed release state for monitoring
   */
  async getReleaseState(
    packageName: string,
    packagePath: string,
    version: string
  ): Promise<ReleaseState> {
    try {
      const { stdout: commitsSince } = await execAsync(
        `cd ${packagePath} && git rev-list --count v${version}..HEAD -- .`
      );

      const commits = parseInt(commitsSince.trim() || '0', 10);
      const hasChanges = commits > 0;

      let proposedVersion = version;
      try {
        const analysis = await changeTrackerService.analyzeChanges(
          packageName,
          packagePath,
          version,
          `v${version}`
        );
        proposedVersion = analysis.proposedVersion;
      } catch {
        // Continue without proposed version
      }

      return {
        packageName,
        currentVersion: version,
        hasCommitsSinceLastTag: hasChanges,
        proposedVersion,
      };
    } catch (error) {
      console.error(`Failed to get release state for ${packageName}:`, error);
      return {
        packageName,
        currentVersion: version,
        hasCommitsSinceLastTag: false,
      };
    }
  }

  /**
   * Print formatted readiness report
   */
  printReadinessReport(validation: PrePublishValidation): void {
    console.log('\n📋 RELEASE READINESS REPORT');
    console.log('═'.repeat(60));

    if (validation.globalBlockers.length > 0) {
      console.log('\n⚠️  GLOBAL BLOCKERS:');
      validation.globalBlockers.forEach(blocker => console.log(`  ${blocker}`));
    }

    console.log('\n📦 PACKAGE STATUS:');
    for (const check of validation.allChecks) {
      const status = check.isReady ? '✅' : '❌';
      console.log(`\n${status} ${check.packageName}@${check.currentVersion}`);

      if (check.reasons.length > 0) {
        console.log('  Reasons:');
        check.reasons.forEach(r => console.log(`    ${r}`));
      }

      if (check.blockers.length > 0) {
        console.log('  Blockers:');
        check.blockers.forEach(b => console.log(`    ${b}`));
      }

      if (check.warnings.length > 0) {
        console.log('  Warnings:');
        check.warnings.forEach(w => console.log(`    ${w}`));
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(
      `📊 Summary: ${validation.summary.readyCount} ready, ${validation.summary.blockedCount} blocked, ${validation.summary.warningCount} warnings`
    );
    console.log(
      `🚀 Can proceed: ${validation.canProceed ? '✅ YES' : '❌ NO'}\n`
    );
  }
}

export const releaseReadinessService = new ReleaseReadinessService();
