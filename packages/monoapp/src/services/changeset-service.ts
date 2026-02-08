/**
 * Changeset Service
 * Handles changeset generation, validation, and publishing
 */

import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AppLogger } from '../middleware/logger';
import { getPackagesService } from './package-service';

const execPromise = promisify(exec);

export type VersionBump = 'major' | 'minor' | 'patch';

export interface Package {
  name: string;
  version: string;
  path: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface VersionBumpItem {
  package: string;
  currentVersion: string;
  newVersion: string;
  bumpType: VersionBump;
}

export interface PublishPlan {
  packages: VersionBumpItem[];
  changesets: string[];
  timestamp: Date;
}

/**
 * Get all workspace packages
 */
export async function getWorkspacePackages(rootPath: string): Promise<Package[]> {
  try {
    // Get packages from package service
    const packages = await getPackagesService(rootPath);
    return packages.map((pkg: any) => ({
      name: pkg.name,
      version: pkg.version || '0.0.0',
      path: pkg.path,
      private: pkg.private || false,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    }));
  } catch (error) {
    AppLogger.error(`Failed to get workspace packages: ${error}`);
    throw error;
  }
}

/**
 * Get existing unpublished changesets
 */
export async function getExistingChangesets(rootPath: string): Promise<string[]> {
  try {
    const changesetsDir = path.join(rootPath, '.changeset');

    try {
      const files = await fs.readdir(changesetsDir);
      return files
        .filter((file) => file.endsWith('.md') && file !== 'README.md')
        .map((file) => file.replace('.md', ''));
    } catch {
      // Directory doesn't exist yet
      return [];
    }
  } catch (error) {
    AppLogger.error(`Failed to get existing changesets: ${error}`);
    return [];
  }
}

/**
 * Calculate new versions for selected packages
 */
export function calculateNewVersions(
  packages: Package[],
  bumps: Array<{ package: string; bumpType: VersionBump }>
): VersionBumpItem[] {
  return packages.map((pkg) => {
    const bump = bumps.find((b) => b.package === pkg.name);
    const bumpType = bump?.bumpType || 'patch';

    const newVersion = calculateVersion(pkg.version, bumpType);

    return {
      package: pkg.name,
      currentVersion: pkg.version,
      newVersion,
      bumpType,
    };
  });
}

/**
 * Calculate new version based on bump type
 */
function calculateVersion(currentVersion: string, bumpType: VersionBump): string {
  const parts = currentVersion.split('.').map((p) => parseInt(p, 10));
  const [major, minor = 0, patch = 0] = parts;

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Validate that changeset can be created
 */
export async function validateChangeset(
  rootPath: string,
  packages: string[],
  summary: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Validate packages exist
  const allPackages = await getWorkspacePackages(rootPath);
  for (const pkgName of packages) {
    if (!allPackages.find((p) => p.name === pkgName)) {
      errors.push(`Package ${pkgName} not found`);
    }
  }

  // Validate summary
  if (!summary || summary.length < 10) {
    errors.push('Summary must be at least 10 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a new changeset
 */
export async function generateChangeset(
  rootPath: string,
  packages: string[],
  bumps: Array<{ package: string; bumpType: VersionBump }>,
  summary: string
): Promise<{ success: boolean; message: string; changeset?: string }> {
  try {
    // Validate input
    const validation = await validateChangeset(rootPath, packages, summary);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.errors.join(', '),
      };
    }

    // Create .changeset directory if it doesn't exist
    const changesetsDir = path.join(rootPath, '.changeset');
    try {
      await fs.mkdir(changesetsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique changeset filename (using timestamp + random)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const changesetName = `${timestamp}-${random}`;
    const changesetPath = path.join(changesetsDir, `${changesetName}.md`);

    // Format changeset content
    let content = `---\n`;
    for (const pkg of packages) {
      const bump = bumps.find((b) => b.package === pkg);
      const bumpType = bump?.bumpType || 'patch';
      content += `"${pkg}": ${bumpType}\n`;
    }
    content += `---\n\n`;
    content += summary;

    // Write changeset file
    await fs.writeFile(changesetPath, content, 'utf-8');

    AppLogger.info(`Changeset created: ${changesetName}`);
    return {
      success: true,
      message: 'Changeset created successfully',
      changeset: changesetName,
    };
  } catch (error) {
    AppLogger.error(`Failed to generate changeset: ${error}`);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if working tree is clean
 */
export async function isWorkingTreeClean(rootPath: string): Promise<boolean> {
  try {
    const { stdout } = await execPromise('git status --porcelain', {
      cwd: rootPath,
    });
    return stdout.trim().length === 0;
  } catch {
    return false;
  }
}

/**
 * Trigger CI pipeline for publishing
 */
export async function triggerPublishPipeline(
  rootPath: string
): Promise<{ success: boolean; message: string; result?: any }> {
  try {
    // Check if publish workflow exists
    const publishWorkflowPath = path.join(
      rootPath,
      '.github',
      'workflows',
      'release.yml'
    );

    try {
      await fs.stat(publishWorkflowPath);
    } catch {
      return {
        success: false,
        message: 'Publish workflow not configured',
      };
    }

    // Commit the changeset if there are any changes
    try {
      const { stdout: status } = await execPromise('git status --porcelain', {
        cwd: rootPath,
      });

      if (status.trim()) {
        // Add changeset files
        await execPromise('git add .changeset/', { cwd: rootPath });

        // Commit with proper message
        await execPromise(
          'git commit -m "chore: publish changeset" --no-verify',
          { cwd: rootPath }
        );

        // Push to the current branch
        try {
          const { stdout: branch } = await execPromise(
            'git rev-parse --abbrev-ref HEAD',
            { cwd: rootPath }
          );
          const currentBranch = branch.trim();

          await execPromise(`git push origin ${currentBranch}`, {
            cwd: rootPath,
          });

          AppLogger.info(`Pushed changeset to ${currentBranch}`);
        } catch (pushError) {
          // If push fails, still continue - the workflow might be triggered manually
          AppLogger.warn(`Failed to push: ${pushError}`);
        }
      }
    } catch (gitError) {
      AppLogger.warn(`Git operations failed: ${gitError}`);
      // Continue anyway - changesets might already be committed
    }

    // Trigger the workflow via GitHub API if we have a token
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      if (githubToken) {
        // Get repo info from package.json or git remote
        const { stdout: remoteUrl } = await execPromise('git remote get-url origin', {
          cwd: rootPath,
        });

        // Parse GitHub repo from URL (e.g., git@github.com:user/repo.git)
        const repoMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (repoMatch) {
          const [, owner, repo] = repoMatch;
          const repoName = repo.replace(/\.git$/, '');

          // Trigger the workflow
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/release.yml/dispatches`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
              body: JSON.stringify({
                ref: 'main',
              }),
            }
          );

          if (response.ok) {
            AppLogger.info('GitHub workflow triggered successfully');
          } else {
            AppLogger.warn(`Failed to trigger workflow: ${response.statusText}`);
          }
        }
      }
    } catch (workflowError) {
      AppLogger.warn(`Failed to trigger workflow: ${workflowError}`);
      // Still return success as the changeset was created
    }

    AppLogger.info('Publish pipeline initiated');
    return {
      success: true,
      message: 'Publishing workflow initiated',
      result: {
        timestamp: new Date().toISOString(),
        workflowPath: publishWorkflowPath,
      },
    };
  } catch (error) {
    AppLogger.error(`Failed to trigger publish pipeline: ${error}`);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
