"use strict";
/**
 * Changeset Service
 * Handles changeset generation, validation, and publishing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspacePackages = getWorkspacePackages;
exports.getExistingChangesets = getExistingChangesets;
exports.calculateNewVersions = calculateNewVersions;
exports.validateChangeset = validateChangeset;
exports.generateChangeset = generateChangeset;
exports.isWorkingTreeClean = isWorkingTreeClean;
exports.triggerPublishPipeline = triggerPublishPipeline;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = require("../middleware/logger");
const package_service_1 = require("./package-service");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Get all workspace packages
 */
async function getWorkspacePackages(rootPath) {
    try {
        // Get packages from package service
        const packages = await (0, package_service_1.getPackagesService)(rootPath);
        return packages.map((pkg) => ({
            name: pkg.name,
            version: pkg.version || '0.0.0',
            path: pkg.path,
            private: pkg.private || false,
            dependencies: pkg.dependencies || {},
            devDependencies: pkg.devDependencies || {},
        }));
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to get workspace packages: ${error}`);
        throw error;
    }
}
/**
 * Get existing unpublished changesets
 */
async function getExistingChangesets(rootPath) {
    try {
        const changesetsDir = path_1.default.join(rootPath, '.changeset');
        try {
            const files = await promises_1.default.readdir(changesetsDir);
            return files
                .filter((file) => file.endsWith('.md') && file !== 'README.md')
                .map((file) => file.replace('.md', ''));
        }
        catch {
            // Directory doesn't exist yet
            return [];
        }
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to get existing changesets: ${error}`);
        return [];
    }
}
/**
 * Calculate new versions for selected packages
 */
function calculateNewVersions(packages, bumps) {
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
function calculateVersion(currentVersion, bumpType) {
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
async function validateChangeset(rootPath, packages, summary) {
    const errors = [];
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
async function generateChangeset(rootPath, packages, bumps, summary) {
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
        const changesetsDir = path_1.default.join(rootPath, '.changeset');
        try {
            await promises_1.default.mkdir(changesetsDir, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
        // Generate unique changeset filename (using timestamp + random)
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        const changesetName = `${timestamp}-${random}`;
        const changesetPath = path_1.default.join(changesetsDir, `${changesetName}.md`);
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
        await promises_1.default.writeFile(changesetPath, content, 'utf-8');
        logger_1.AppLogger.info(`Changeset created: ${changesetName}`);
        return {
            success: true,
            message: 'Changeset created successfully',
            changeset: changesetName,
        };
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to generate changeset: ${error}`);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * Check if working tree is clean
 */
async function isWorkingTreeClean(rootPath) {
    try {
        const { stdout } = await execPromise('git status --porcelain', {
            cwd: rootPath,
        });
        return stdout.trim().length === 0;
    }
    catch {
        return false;
    }
}
/**
 * Trigger CI pipeline for publishing
 */
async function triggerPublishPipeline(rootPath) {
    try {
        // Check if publish workflow exists
        const publishWorkflowPath = path_1.default.join(rootPath, '.github', 'workflows', 'release.yml');
        try {
            await promises_1.default.stat(publishWorkflowPath);
        }
        catch {
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
                await execPromise('git commit -m "chore: publish changeset" --no-verify', { cwd: rootPath });
                // Push to the current branch
                try {
                    const { stdout: branch } = await execPromise('git rev-parse --abbrev-ref HEAD', { cwd: rootPath });
                    const currentBranch = branch.trim();
                    await execPromise(`git push origin ${currentBranch}`, {
                        cwd: rootPath,
                    });
                    logger_1.AppLogger.info(`Pushed changeset to ${currentBranch}`);
                }
                catch (pushError) {
                    // If push fails, still continue - the workflow might be triggered manually
                    logger_1.AppLogger.warn(`Failed to push: ${pushError}`);
                }
            }
        }
        catch (gitError) {
            logger_1.AppLogger.warn(`Git operations failed: ${gitError}`);
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
                    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/actions/workflows/release.yml/dispatches`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${githubToken}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                        body: JSON.stringify({
                            ref: 'main',
                        }),
                    });
                    if (response.ok) {
                        logger_1.AppLogger.info('GitHub workflow triggered successfully');
                    }
                    else {
                        logger_1.AppLogger.warn(`Failed to trigger workflow: ${response.statusText}`);
                    }
                }
            }
        }
        catch (workflowError) {
            logger_1.AppLogger.warn(`Failed to trigger workflow: ${workflowError}`);
            // Still return success as the changeset was created
        }
        logger_1.AppLogger.info('Publish pipeline initiated');
        return {
            success: true,
            message: 'Publishing workflow initiated',
            result: {
                timestamp: new Date().toISOString(),
                workflowPath: publishWorkflowPath,
            },
        };
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to trigger publish pipeline: ${error}`);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
