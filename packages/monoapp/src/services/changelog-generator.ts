/**
 * Changelog Generator
 * Generates CHANGELOG.md entries from detected changes
 * Supports multiple formatting styles
 */

import { readFile, writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

interface ChangelogEntry {
  version: string;
  date: string; // ISO format
  breakingChanges: ChangelogItem[];
  features: ChangelogItem[];
  fixes: ChangelogItem[];
  improvements: ChangelogItem[];
  internal: string[];
}

interface ChangelogItem {
  scope?: string;
  description: string;
  hash?: string;
}

interface CommitInfo {
  type:
    | 'feat'
    | 'fix'
    | 'refactor'
    | 'perf'
    | 'style'
    | 'docs'
    | 'test'
    | 'chore'
    | 'ci'
    | 'other';
  scope?: string;
  message: string;
  hash: string;
  isBreaking: boolean;
  body?: string;
}

export class ChangelogGenerator {
  /**
   * Generate changelog entry for a package
   */
  async generateEntry(
    packageName: string,
    newVersion: string,
    previousVersion: string | null,
    commits: CommitInfo[]
  ): Promise<ChangelogEntry> {
    const entry: ChangelogEntry = {
      version: newVersion,
      date: new Date().toISOString().split('T')[0],
      breakingChanges: [],
      features: [],
      fixes: [],
      improvements: [],
      internal: [],
    };

    // Categorize commits
    for (const commit of commits) {
      const item: ChangelogItem = {
        scope: commit.scope,
        description: commit.message,
        hash: commit.hash,
      };

      if (commit.isBreaking) {
        entry.breakingChanges.push({
          ...item,
          description: `**BREAKING**: ${commit.message}`,
        });
      }

      switch (commit.type) {
        case 'feat':
          entry.features.push(item);
          break;
        case 'fix':
        case 'refactor':
        case 'perf':
          entry.fixes.push(item);
          break;
        case 'docs':
        case 'style':
        case 'test':
        case 'chore':
        case 'ci':
          entry.internal.push(commit.message);
          break;
        default:
          entry.improvements.push(item);
      }
    }

    return entry;
  }

  /**
   * Format changelog entry as markdown
   */
  formatEntryAsMarkdown(entry: ChangelogEntry, packageName: string): string {
    const lines: string[] = [];

    // Header with version and date
    const githubTag = `${packageName}@${entry.version}`;
    lines.push(
      `## [${githubTag}](https://github.com/manojkmfsi/monodog/releases/tag/${githubTag}) (${entry.date})`
    );
    lines.push('');

    // Breaking changes
    if (entry.breakingChanges.length > 0) {
      lines.push('### ⚠️ BREAKING CHANGES');
      for (const item of entry.breakingChanges) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        lines.push(`- ${scope}${item.description}`);
      }
      lines.push('');
    }

    // Features
    if (entry.features.length > 0) {
      lines.push('### Features');
      for (const item of entry.features) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        const hash = item.hash
          ? ` ([${item.hash.slice(0, 7)}](https://github.com/manojkmfsi/monodog/commit/${item.hash}))`
          : '';
        lines.push(`- ${scope}${item.description}${hash}`);
      }
      lines.push('');
    }

    // Bug Fixes
    if (entry.fixes.length > 0) {
      lines.push('### Bug Fixes');
      for (const item of entry.fixes) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        const hash = item.hash
          ? ` ([${item.hash.slice(0, 7)}](https://github.com/manojkmfsi/monodog/commit/${item.hash}))`
          : '';
        lines.push(`- ${scope}${item.description}${hash}`);
      }
      lines.push('');
    }

    // Improvements
    if (entry.improvements.length > 0) {
      lines.push('### Improvements');
      for (const item of entry.improvements) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        const hash = item.hash
          ? ` ([${item.hash.slice(0, 7)}](https://github.com/manojkmfsi/monodog/commit/${item.hash}))`
          : '';
        lines.push(`- ${scope}${item.description}${hash}`);
      }
      lines.push('');
    }

    // Internal (if any)
    if (entry.internal.length > 0) {
      lines.push('### Internal');
      for (const item of entry.internal) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Append entry to CHANGELOG.md file
   */
  async appendToChangelog(
    packagePath: string,
    entry: ChangelogEntry,
    packageName: string
  ): Promise<void> {
    const changelogPath = join(packagePath, 'CHANGELOG.md');

    try {
      const markdown = this.formatEntryAsMarkdown(entry, packageName);

      // Check if file exists
      try {
        const existingContent = await readFile(changelogPath, 'utf8');
        // Prepend new entry to existing changelog
        const updateContent = `${markdown}\n${existingContent}`;
        await writeFile(changelogPath, updateContent);
      } catch (error) {
        // File doesn't exist, create it with header
        const header = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
        await writeFile(changelogPath, header + markdown);
      }
    } catch (error) {
      console.error(`Failed to update changelog for ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Parse existing CHANGELOG.md to get entry structure
   */
  async parseExistingChangelog(changelogPath: string): Promise<string[]> {
    try {
      const content = await readFile(changelogPath, 'utf8');
      return content.split('\n');
    } catch (error) {
      console.warn(`Could not parse existing changelog: ${error}`);
      return [];
    }
  }

  /**
   * Generate changelog entries for multiple packages
   */
  async generateMultiple(
    packages: Array<{
      name: string;
      path: string;
      newVersion: string;
      previousVersion: string | null;
      commits: CommitInfo[];
    }>
  ): Promise<Map<string, ChangelogEntry>> {
    const entries = new Map<string, ChangelogEntry>();

    for (const pkg of packages) {
      const entry = await this.generateEntry(
        pkg.name,
        pkg.newVersion,
        pkg.previousVersion,
        pkg.commits
      );
      entries.set(pkg.name, entry);
    }

    return entries;
  }
}

export const changelogGenerator = new ChangelogGenerator();
