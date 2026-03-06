/**
 * Change Tracker Service
 * Detects changes in packages using Conventional Commits and Git diffs
 * Replaces dependency on .changeset/*.md files
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

// NOTE: ChangeTrack and CommitChange types will be imported from @prisma/client after DB integration
// Currently using inline types below for service implementation

const execAsync = promisify(exec);
const prisma = new PrismaClient();

type ChangeType = 'major' | 'minor' | 'patch' | 'none';
type ConventionalType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'test'
  | 'chore'
  | 'perf'
  | 'ci'
  | 'revert'
  | 'build';

interface DetectedCommit {
  hash: string;
  message: string;
  author: string;
  authorEmail?: string;
  committedAt: Date;
  type: ConventionalType;
  scope?: string;
  isBreaking: boolean;
  body?: string;
}

interface FileChange {
  path: string;
  added: boolean;
  removed: boolean;
  modified: boolean;
  linesAdded: number;
  linesRemoved: number;
}

interface AnalysisResult {
  packageName: string;
  currentVersion: string;
  changeType: ChangeType;
  commits: DetectedCommit[];
  filesChanged: FileChange[];
  affectedDependents: string[];
  proposedVersion: string;
  isReleaseReady: boolean;
}

export class ChangeTrackerService {
  /**
   * Save a ChangeTrack record and its related commits to the database
   */
  async saveChangeTrack(result: AnalysisResult): Promise<void> {
    // Save ChangeTrack
    const changeTrack = await prisma.changeTrack.create({
      data: {
        packageName: result.packageName,
        packageVersion: result.currentVersion,
        detectionMethod: 'git',
        detectionTimestamp: new Date(),
        filesChanged: JSON.stringify(result.filesChanged.map(f => f.path)),
        linesAdded: result.filesChanged.reduce(
          (sum, f) => sum + (f.linesAdded || 0),
          0
        ),
        linesRemoved: result.filesChanged.reduce(
          (sum, f) => sum + (f.linesRemoved || 0),
          0
        ),
        changeType: result.changeType,
        affectedDependents: JSON.stringify(result.affectedDependents),
        isReleaseReady: result.isReleaseReady,
        lastAnalyzedCommit: result.commits[0]?.hash || '',
        previousVersion: result.currentVersion,
        proposedVersion: result.proposedVersion,
        // createdAt, updatedAt auto
      },
    });

    // Save related commits
    for (const commit of result.commits) {
      await prisma.commitChange.create({
        data: {
          changeTrackId: changeTrack.id,
          hash: commit.hash,
          message: commit.message,
          author: commit.author,
          authorEmail: commit.authorEmail,
          type: commit.type,
          scope: commit.scope,
          isBreaking: commit.isBreaking,
          bodyText: commit.body,
          committedAt: commit.committedAt,
        },
      });
    }
  }

  /**
   * Load the latest ChangeTrack for a package
   */
  async getLatestChangeTrack(packageName: string): Promise<any> {
    return prisma.changeTrack.findFirst({
      where: { packageName },
      orderBy: { createdAt: 'desc' },
      include: { commits: true },
    });
  }
  /**
   * Analyze changes for a package since last release
   */
  async analyzeChanges(
    packageName: string,
    packagePath: string,
    currentVersion: string,
    lastTagName: string = `${packageName}@${currentVersion}`
  ): Promise<AnalysisResult> {
    try {
      // 1. Get commits since last tag
      const commits = await this.getCommitsSinceTag(lastTagName, packagePath);

      // 2. Get file diffs
      const filesChanged = await this.getFileDiffsSinceTag(
        lastTagName,
        packagePath
      );

      // 3. Determine change type from commits
      const changeType = this.determineChangeType(commits);

      // 4. Identify affected dependents
      const affectedDependents =
        await this.identifyAffectedDependents(packageName);

      const result: AnalysisResult = {
        packageName,
        currentVersion,
        changeType,
        commits,
        filesChanged,
        affectedDependents,
        proposedVersion: this.calculateNextVersion(currentVersion, changeType),
        isReleaseReady: changeType !== 'none',
      };

      // Save to DB
      await this.saveChangeTrack(result);

      return result;
    } catch (error) {
      console.error(`Failed to analyze changes for ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Parse commit message using Conventional Commits format
   * https://www.conventionalcommits.org/
   *
   * Format: type(scope)!: subject
   * BREAKING CHANGE: description
   */
  private parseConventionalCommit(
    message: string,
    body?: string
  ): {
    type: ConventionalType;
    scope?: string;
    isBreaking: boolean;
  } {
    const conventionalRegex =
      /^(feat|fix|docs|style|refactor|test|chore|perf|ci|revert|build)(\(.+\))?(!)?:\s(.+)/;

    // Handle undefined or empty message
    if (!message) {
      return {
        type: 'chore' as ConventionalType,
        scope: undefined,
        isBreaking: false,
      };
    }

    const match = message.match(conventionalRegex);

    if (!match) {
      return {
        type: 'chore' as ConventionalType,
        scope: undefined,
        isBreaking: false,
      };
    }

    const [, type, scopeMatch, breakingIndicator, subject] = match;
    const scope = scopeMatch ? scopeMatch.slice(1, -1) : undefined;

    // Check for BREAKING CHANGE keyword in body
    const isBreaking =
      !!breakingIndicator ||
      (body ? /^BREAKING[\s-]CHANGE:/m.test(body) : false);

    return {
      type: type as ConventionalType,
      scope,
      isBreaking,
    };
  }

  /**
   * Get commits since last tag (public for changelog generation)
   */
  async getCommitsSinceTag(
    tagName: string,
    packagePath: string
  ): Promise<DetectedCommit[]> {
    try {
      // Get commits since tag, limited to this package path
      const { stdout } = await execAsync(
        `cd ${packagePath} && git log ${tagName}..HEAD --format='%H|||%ae|||%an|||%ai|||%s|||%b' --`,
        { shell: '/bin/bash' }
      );

      if (!stdout.trim()) {
        return [];
      }

      const commits: DetectedCommit[] = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, email, author, timestamp, subject, body] =
            line.split('|||');
          const parsed = this.parseConventionalCommit(subject || '', body);
          return {
            hash,
            message: subject,
            author: author || email,
            authorEmail: email,
            committedAt: new Date(timestamp),
            type: parsed.type,
            scope: parsed.scope,
            isBreaking: parsed.isBreaking,
            body: body?.trim() || undefined,
          };
        });
      return commits;
    } catch (error) {
      // If tag doesn't exist, get all commits (first release)
      console.warn(`Tag ${tagName} not found, analyzing all commits`);
      return this.getAllCommits(packagePath);
    }
  }

  /**
   * Get all commits for a package
   */
  private async getAllCommits(packagePath: string): Promise<DetectedCommit[]> {
    try {
      const { stdout } = await execAsync(
        `cd ${packagePath} && git log --format='%H|||%ae|||%an|||%ai|||%s|||%b' --`,
        { shell: '/bin/bash' }
      );

      if (!stdout.trim()) {
        return [];
      }

      return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, email, author, timestamp, subject, body] =
            line.split('|||');
          const parsed = this.parseConventionalCommit(subject || '', body);
          return {
            hash,
            message: subject,
            author: author || email,
            authorEmail: email,
            committedAt: new Date(timestamp),
            type: parsed.type,
            scope: parsed.scope,
            isBreaking: parsed.isBreaking,
            body: body?.trim() || undefined,
          };
        });
    } catch (error) {
      console.error(`Failed to get commits for ${packagePath}:`, error);
      return [];
    }
  }

  /**
   * Get file diffs since last tag
   */
  private async getFileDiffsSinceTag(
    tagName: string,
    packagePath: string
  ): Promise<FileChange[]> {
    try {
      // Get file stats in diff format
      const { stdout } = await execAsync(
        `cd ${packagePath} && git diff --no-renames --numstat ${tagName}..HEAD --`,
        { shell: '/bin/bash' }
      );

      if (!stdout.trim()) {
        return [];
      }

      return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [added, removed, filePath] = line.split('\t');
          return {
            path: filePath,
            added: false,
            removed: false,
            modified: true,
            linesAdded: parseInt(added) || 0,
            linesRemoved: parseInt(removed) || 0,
          };
        });
    } catch (error) {
      console.warn(`Failed to get diffs for ${packagePath}:`, error);
      return [];
    }
  }

  /**
   * Determine change type based on commits
   * Rules:
   * - BREAKING CHANGE or ! → major
   * - feat: → minor
   * - fix:, refactor:, etc → patch
   * - docs:, chore:, etc → none
   */
  private determineChangeType(commits: DetectedCommit[]): ChangeType {
    if (commits.length === 0) {
      return 'none';
    }

    // Check for breaking changes first
    if (commits.some(c => c.isBreaking)) {
      return 'major';
    }

    // Check for features
    if (commits.some(c => c.type === 'feat')) {
      return 'minor';
    }

    // Check for fixes and other meaningful changes
    if (commits.some(c => ['fix', 'refactor', 'perf'].includes(c.type))) {
      return 'patch';
    }

    // Everything else (docs, chore, style, test, etc) doesn't warrant a release
    return 'none';
  }

  /**
   * Calculate next semantic version
   */
  private calculateNextVersion(
    currentVersion: string,
    changeType: ChangeType
  ): string {
    if (changeType === 'none') {
      return currentVersion;
    }

    const parts = currentVersion.split('.');
    const [major, minor, patch] = parts.map(p => parseInt(p));

    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return currentVersion;
    }
  }

  /**
   * Identify packages that depend on this package
   */
  private async identifyAffectedDependents(
    packageName: string
  ): Promise<string[]> {
    // TODO: Implement dependency graph analysis
    // For now, return empty array - can be enhanced with dependency resolver
    return [];
  }
}

export const changeTrackerService = new ChangeTrackerService();
