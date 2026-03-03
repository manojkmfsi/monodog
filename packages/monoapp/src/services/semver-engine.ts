/**
 * SemVer Engine
 * Handles semantic versioning calculations and dependency updates
 * Replaces @changesets/cli version bump logic
 */

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
  metadata: string | null;
}

interface DependencyUpdate {
  name: string;
  currentVersion: string;
  newVersion: string;
}

export class SemVerEngine {
  /**
   * Parse a semantic version string
   * Supports: 1.2.3, 1.2.3-alpha, 1.2.3+build, 1.2.3-alpha+build
   */
  parseVersion(version: string): SemVer {
    const versionRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
    const match = version.match(versionRegex);

    if (!match) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    const [, major, minor, patch, prerelease, metadata] = match;

    return {
      major: parseInt(major),
      minor: parseInt(minor),
      patch: parseInt(patch),
      prerelease: prerelease || null,
      metadata: metadata || null,
    };
  }

  /**
   * Format SemVer object to string
   */
  formatVersion(semver: SemVer): string {
    let version = `${semver.major}.${semver.minor}.${semver.patch}`;
    if (semver.prerelease) {
      version += `-${semver.prerelease}`;
    }
    if (semver.metadata) {
      version += `+${semver.metadata}`;
    }
    return version;
  }

  /**
   * Calculate next version based on change type
   * changeType: 'major' | 'minor' | 'patch' | 'none'
   */
  calculateNextVersion(
    currentVersion: string,
    changeType: 'major' | 'minor' | 'patch' | 'none',
    includePrerelease = false
  ): string {
    if (changeType === 'none') {
      return currentVersion;
    }

    const semver = this.parseVersion(currentVersion);

    // Remove prerelease/metadata
    semver.prerelease = null;
    semver.metadata = null;

    switch (changeType) {
      case 'major':
        semver.major++;
        semver.minor = 0;
        semver.patch = 0;
        break;
      case 'minor':
        semver.minor++;
        semver.patch = 0;
        break;
      case 'patch':
        semver.patch++;
        break;
    }

    // Add prerelease tag if requested
    if (includePrerelease) {
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      semver.prerelease = `alpha.${timestamp}`;
    }

    return this.formatVersion(semver);
  }

  /**
   * Update package.json dependencies with new versions
   * Respects semver ranges: ^, ~, ==
   */
  updateDependencyVersions(
    packageJson: Record<string, any>,
    versionMap: Map<string, string>
  ): Record<string, any> {
    const updated = JSON.parse(JSON.stringify(packageJson));

    // Helper to update a dependency object
    const updateDeps = (deps: Record<string, string> | undefined) => {
      if (!deps) return;

      for (const [depName, depSpec] of Object.entries(deps)) {
        if (!versionMap.has(depName)) continue;

        const newVersion = versionMap.get(depName)!;

        // Preserve range prefixes
        if (depSpec.startsWith('^')) {
          deps[depName] = `^${newVersion}`;
        } else if (depSpec.startsWith('~')) {
          deps[depName] = `~${newVersion}`;
        } else if (depSpec.startsWith('=') || /^\d+/.test(depSpec)) {
          deps[depName] = newVersion;
        } else {
          // Keep original range syntax if not recognized
          deps[depName] = depSpec;
        }
      }
    };

    // Update all dependency types
    updateDeps(updated.dependencies);
    updateDeps(updated.devDependencies);
    updateDeps(updated.peerDependencies);
    updateDeps(updated.optionalDependencies);

    return updated;
  }

  /**
   * Calculate version bumps for multiple packages
   * Takes into account:
   * - Direct changes (from ChangeTrack)
   * - Dependent packages (cascade bumps)
   */
  calculateBumps(
    packageChanges: Map<string, 'major' | 'minor' | 'patch'>,
    dependencyGraph: Map<string, string[]> // package → dependencies
  ): Map<string, { type: 'major' | 'minor' | 'patch'; reason: string }> {
    const bumps = new Map<string, { type: 'major' | 'minor' | 'patch'; reason: string }>();

    // 1. Add direct changes
    for (const [pkgName, changeType] of packageChanges.entries()) {
      bumps.set(pkgName, {
        type: changeType,
        reason: `Direct change detected (${changeType})`,
      });
    }

    // 2. Propagate bumps to dependents
    // If A changes with major/minor, all packages depending on A get minor bump
    // If A changes with patch, dependents only if there's a breaking change
    const visited = new Set<string>();
    const propagateChanges = (packageName: string, sourceChangeType: string) => {
      if (visited.has(packageName)) return;
      visited.add(packageName);

      // Find all packages that depend on this one
      for (const [depender, dependencies] of dependencyGraph.entries()) {
        if (dependencies.includes(packageName)) {
          const existingBump = bumps.get(depender);
          const newBump =
            sourceChangeType === 'major' ? 'minor' : sourceChangeType === 'minor' ? 'patch' : 'patch';

          // Only update if we haven't bumped this yet, or this is a higher bump
          if (!existingBump) {
            bumps.set(depender, {
              type: newBump,
              reason: `Dependent on ${packageName} (${sourceChangeType})`,
            });
            propagateChanges(depender, newBump);
          }
        }
      }
    };

    for (const [pkgName, { type }] of bumps.entries()) {
      propagateChanges(pkgName, type);
    }

    return bumps;
  }

  /**
   * Validate that a version doesn't already exist on npm registry
   */
  async isVersionAvailableOnNpm(
    packageName: string,
    version: string,
    registry = 'https://registry.npmjs.org'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${registry}/${packageName}/${version}`);
      // 404 means version doesn't exist (good!)
      return response.status === 404;
    } catch (error) {
      console.error(`Failed to check npm registry for ${packageName}@${version}:`, error);
      throw error;
    }
  }

  /**
   * Get latest published version from npm registry
   */
  async getLatestVersionOnNpm(
    packageName: string,
    registry = 'https://registry.npmjs.org'
  ): Promise<string> {
    try {
      const response = await fetch(`${registry}/${packageName}`);
      if (!response.ok) {
        throw new Error(`Package ${packageName} not found on npm`);
      }

      const data = (await response.json()) as any;
      return data['dist-tags']?.latest || '0.0.0';
    } catch (error) {
      console.error(`Failed to fetch npm info for ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Compare two versions
   * Returns: -1 (v1 < v2), 0 (equal), 1 (v1 > v2)
   */
  compareVersions(v1: string, v2: string): -1 | 0 | 1 {
    const s1 = this.parseVersion(v1);
    const s2 = this.parseVersion(v2);

    if (s1.major !== s2.major) {
      return s1.major > s2.major ? 1 : -1;
    }
    if (s1.minor !== s2.minor) {
      return s1.minor > s2.minor ? 1 : -1;
    }
    if (s1.patch !== s2.patch) {
      return s1.patch > s2.patch ? 1 : -1;
    }

    // Handle prerelease versions
    if (s1.prerelease && !s2.prerelease) return -1;
    if (!s1.prerelease && s2.prerelease) return 1;
    if (s1.prerelease === s2.prerelease) return 0;

    return s1.prerelease! > s2.prerelease! ? 1 : -1;
  }

  /**
   * Validate version string format
   */
  isValidVersion(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }
}

export const semverEngine = new SemVerEngine();
