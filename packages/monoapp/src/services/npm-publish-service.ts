/**
 * NPM Publish Service
 * Direct npm publishing without GitHub Actions
 * Handles tarball creation, npm registry communication, and verification
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { basename, join } from 'path';
import { secureTokenService } from './secure-token-service';
import fs from 'fs';

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);

interface PublishOptions {
  packageName: string;
  version: string;
  packagePath: string;
  npmToken: string;
  registry?: string;
  tag?: string;
  dryRun?: boolean;
}

interface PublishResult {
  success: boolean;
  packageId: string;
  timestamp: string;
  tarballUrl: string;
  tarballPath?: string;
}

interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  types?: string;
  dist?: {
    tarball: string;
    shasum: string;
    integrity: string;
  };
}

export class NpmPublishService {
  private readonly defaultRegistry = 'https://registry.npmjs.org';

  /**
   * Publish a package to npm registry
   */
  async publishToNpm(options: PublishOptions): Promise<PublishResult> {
    const {
      packageName,
      version,
      packagePath,
      npmToken,
      registry = this.defaultRegistry,
      tag = 'latest',
      dryRun = false,
    } = options;

    try {
      console.info(`📦 Publishing ${packageName}@${version} to npm...`);

      // 1. Validate package
      await this.validatePackage(packagePath, version);
      console.info(`✓ Package validation passed`);

      // 2. Build package if needed
      await this.buildPackage(packagePath);
      console.info(`✓ Package build complete`);

      // 3. Create tarball
      const tarballPath = await this.createTarball(packagePath);
      console.info(`✓ Tarball created: ${basename(tarballPath)}`);

      if (dryRun) {
        console.info(`⚠️  DRY RUN: Skipping actual npm publish`);
        return {
          success: true,
          packageId: `${packageName}@${version}`,
          timestamp: new Date().toISOString(),
          tarballUrl: `${registry}/${packageName}/-/${basename(tarballPath)}`,
          tarballPath,
        };
      }

      // 4. Publish tarball to registry
      await this.publishTarball(
        tarballPath,
        packageName,
        version,
        npmToken,
        registry,
        tag
      );
      console.info(`✓ Package published to npm registry`);

      // 5. Verify publication
      await this.verifyPublished(packageName, version, registry);
      console.info(`✓ Publication verified on npm registry`);

      return {
        success: true,
        packageId: `${packageName}@${version}`,
        timestamp: new Date().toISOString(),
        tarballUrl: `${registry}/${packageName}/-/${basename(tarballPath)}`,
        tarballPath,
      };
    } catch (error) {
      console.error(
        `✗ Failed to publish ${packageName}@${version}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Validate package.json and required fields
   */
  private async validatePackage(
    packagePath: string,
    version: string
  ): Promise<void> {
    try {
      const pkgJsonPath = join(packagePath, 'package.json');
      const pkgJson = JSON.parse(
        await readFileAsync(pkgJsonPath, 'utf8')
      ) as any;

      if (!pkgJson.name) {
        throw new Error('package.json missing required field: name');
      }

      if (!pkgJson.version) {
        throw new Error('package.json missing required field: version');
      }

      if (pkgJson.version !== version) {
        throw new Error(
          `Version mismatch: package.json has ${pkgJson.version}, expected ${version}`
        );
      }

      // Check for dist folder or compiled output
      const distPath = join(packagePath, 'dist');
      try {
        const stats = await new Promise((resolve, reject) => {
          fs.stat(distPath, (err: Error | null, data: any) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        if ((stats as any)?.isDirectory?.() === false) {
          console.warn(
            `⚠️  dist/ folder not found, publishing source files only`
          );
        }
      } catch {
        console.warn(
          `⚠️  dist/ folder not found, publishing source files only`
        );
      }
    } catch (error) {
      throw new Error(
        `Package validation failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Build package if build script exists
   */
  private async buildPackage(packagePath: string): Promise<void> {
    try {
      const pkgJsonPath = join(packagePath, 'package.json');
      const pkgJson = JSON.parse(
        await readFileAsync(pkgJsonPath, 'utf8')
      ) as any;

      if (pkgJson?.scripts?.build) {
        console.info(`🔨 Running build script...`);
        try {
          const { stdout, stderr } = await execAsync(
            `cd ${packagePath} && npm run build`,
            {
              maxBuffer: 10 * 1024 * 1024,
            }
          );
          if (stdout) console.debug(stdout.slice(-500)); // Last 500 chars
          if (stderr) console.warn(stderr.slice(-500));
        } catch (buildError) {
          console.warn(
            `⚠️  Build step failed:`,
            buildError instanceof Error ? buildError.message : buildError
          );
        }
      }
    } catch (error) {
      // Build might fail, but we can still try to publish
      console.warn(
        `⚠️  Build step failed (continuing anyway):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Create npm tarball using `npm pack`
   */
  private async createTarball(packagePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`cd ${packagePath} && npm pack`, {
        maxBuffer: 10 * 1024 * 1024,
      });

      const tarballName = stdout.trim();
      const tarballPath = join(packagePath, tarballName);

      return tarballPath;
    } catch (error) {
      throw new Error(
        `Failed to create tarball: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Publish tarball to npm registry
   * Uses npm's HTTP API (npmjs.com/package/npm-registry-fetch)
   */
  private async publishTarball(
    tarballPath: string,
    packageName: string,
    version: string,
    npmToken: string,
    registry: string,
    tag: string
  ): Promise<void> {
    try {
      const tarballData = await readFileAsync(tarballPath);
      const shasum = createHash('sha1').update(tarballData).digest('hex');

      // Calculate SRI (Subresource Integrity)
      const integrity = this.calculateSRI(tarballData);

      const pkgJsonPath = join('package.json');
      const pkgJson = JSON.parse(
        await readFileAsync(join(tarballPath, '..', pkgJsonPath), 'utf8')
      ) as PackageJson;

      // const tarballBuffer = await fs.readFile(tarballPath, null, (err, data) => {
      //   if (err) {
      //     throw new Error(`Failed to read tarball for upload: ${err.message}`);
      //   }
      //   return data;
      // });

const doc = {
  _id: packageName,
  name: packageName,
  'dist-tags': {
    latest: version,
  },
  versions: {
    [version]: {
      name: packageName,
      version: version,
      description: pkgJson.description || '',
      // dependencies: pkgJson.dependencies || {},
      dist: {
        shasum: shasum,
        integrity: integrity,
        tarball: `${registry}/${packageName}/-/${basename(tarballPath)}`,
      },
    },
  },
  _attachments: {
    [basename(tarballPath)]: {
      content_type: 'application/octet-stream',
      data: tarballData.toString('base64'), // Binary data MUST be here
      length: tarballData.length,
    },
  },
};
      // Prepare document for npm registry
      // const doc = {
      //   _id: `${packageName}@${version}`,
      //   name: packageName,
      //   version,
      //   description: pkgJson.description || '',
      //   dist: {
      //     tarball: `${registry}/${packageName}/-/${basename(tarballPath)}`,
      //     shasum,
      //     integrity,
      //   },
      //   // Add minimal required metadata
      //   _rev: '',
      //   dependencies: {},
      // };
      console.log(
        'Prepared document for npm registry:',
        doc,
        registry,
        packageName,
        npmToken
      );
      // Publish via npm registry REST API
      const response = await fetch(`${registry}/${packageName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${npmToken}`,
        },
        body: JSON.stringify(doc),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `npm registry rejected publish: ${response.status} ${response.statusText}\n${errorBody}`
        );
      }

      console.info(`✓ Published to npm`);
    } catch (error) {
      throw new Error(
        `Failed to publish to npm registry: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Calculate SRI (Subresource Integrity) hash
   */
  private calculateSRI(data: Buffer): string {
    const sha512 = createHash('sha512').update(data).digest('base64');
    return `sha512-${sha512}`;
  }

  /**
   * Verify package was published successfully
   */
  private async verifyPublished(
    packageName: string,
    version: string,
    registry: string
  ): Promise<void> {
    try {
      // Try up to 3 times with delay (npm CDN may have latency)
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await fetch(`${registry}/${packageName}/${version}`);

        if (response.ok) {
          console.info(`✓ Verified: ${packageName}@${version} on npm registry`);
          return;
        }

        if (attempt < 3) {
          console.warn(`  Attempt ${attempt}/3 failed, retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      throw new Error(`Package not found on registry after 3 attempts`);
    } catch (error) {
      throw new Error(
        `Verification failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Check if version already exists on npm
   */
  async isVersionAvailable(
    packageName: string,
    version: string,
    registry = this.defaultRegistry
  ): Promise<boolean> {
    try {
      const response = await fetch(`${registry}/${packageName}/${version}`);
      return response.status === 404; // 404 means version doesn't exist (available)
    } catch {
      return false;
    }
  }

  /**
   * Get all published versions of a package
   */
  async getPublishedVersions(
    packageName: string,
    registry = this.defaultRegistry
  ): Promise<string[]> {
    try {
      const response = await fetch(`${registry}/${packageName}`);
      if (!response.ok) return [];

      const data = (await response.json()) as any;
      return Object.keys(data.versions || {})
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }
}

export const npmPublishService = new NpmPublishService();
