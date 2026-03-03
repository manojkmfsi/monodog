#!/usr/bin/env node

/**
 * INDEPENDENT RELEASE ENGINE - QUICK START GUIDE
 * 
 * This guide walks through publishing a package using the new system
 * that is independent of @changesets and GitHub Actions.
 */

import { publishController } from './services/publish-controller';
import { releaseReadinessService } from './services/release-readiness-service';

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Check If Packages Are Ready for Release
// ═════════════════════════════════════════════════════════════════════════

async function example1_CheckReadiness() {
  console.log('\n📋 EXAMPLE 1: Check Release Readiness\n');

  const packagePaths = {
    '@monodog/core': './packages/core',
    '@monodog/cli': './packages/cli',
  };

  // Get readiness status
  const readiness = await releaseReadinessService.checkReleaseReadiness([
    { name: '@monodog/core', path: './packages/core', currentVersion: '1.0.0' },
    { name: '@monodog/cli', path: './packages/cli', currentVersion: '2.1.0' },
  ]);

  // Print formatted report
  releaseReadinessService.printReadinessReport(readiness);

  // Check if we can proceed
  if (readiness.canProceed) {
    console.log('✅ All packages ready for publishing\n');
  } else {
    console.log('❌ Some packages have blockers. Fix and try again.\n');
  }
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Analyze Changes for a Package
// ═════════════════════════════════════════════════════════════════════════

async function example2_AnalyzeChanges() {
  console.log('\n📊 EXAMPLE 2: Analyze Changes\n');

  const changeAnalysis = await publishController.preparePublish({
    packageNames: ['@monodog/core'],
    packagePaths: { '@monodog/core': './packages/core' },
  });

  if (changeAnalysis.valid) {
    const analysis = changeAnalysis.analysis['@monodog/core'];
    console.log(`Package: @monodog/core`);
    console.log(`  Current Version: ${analysis.currentVersion}`);
    console.log(`  Proposed Version: ${analysis.proposedVersion}`);
    console.log(`  Change Type: ${analysis.changeType}`);
    console.log(`  Files Changed: ${analysis.filesChanged.length}`);
    console.log(`  Commits Since Last Tag: ${analysis.commits.length}\n`);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Dry-Run Publish (No Changes Actually Made)
// ═════════════════════════════════════════════════════════════════════════

async function example3_DryRunPublish() {
  console.log('\n🧪 EXAMPLE 3: Dry-Run Publish (Safe Testing)\n');

  const pipeline = await publishController.publish({
    packageNames: ['@monodog/core'],
    packagePaths: { '@monodog/core': './packages/core' },
    dryRun: true, // ← No actual changes
    autoTag: false,
    createReleases: false,
  });

  console.log(`Pipeline ID: ${pipeline.pipelineId}`);
  console.log(`Status: ${pipeline.status}`);
  console.log(`Progress: ${pipeline.progress}%`);

  const result = pipeline.results['@monodog/core'];
  if (result?.success) {
    console.log(`\n✅ Would publish: ${result.packageId}@${result.version}`);
    console.log(`   npm URL: ${result.npmUrl}\n`);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Actual Publish via Node.js (Direct, Atomic)
// ═════════════════════════════════════════════════════════════════════════

async function example4_PublishViaNode() {
  console.log('\n🚀 EXAMPLE 4: Publish via Node.js\n');

  // Set up npm token from environment or secure token service
  const npmToken = process.env.NPM_TOKEN;

  if (!npmToken) {
    console.error('❌ NPM_TOKEN environment variable required\n');
    return;
  }

  // Publish packages
  const pipeline = await publishController.publish({
    packageNames: ['@monodog/core', '@monodog/cli'],
    packagePaths: {
      '@monodog/core': './packages/core',
      '@monodog/cli': './packages/cli',
    },
    method: 'node', // ← Direct Node.js execution
    dryRun: false,
    autoTag: true, // ← Create git tags
    createReleases: false,
  });

  // Monitor results
  console.log(`Pipeline: ${pipeline.pipelineId}`);
  console.log(`Status: ${pipeline.status}`);
  console.log(`Duration: ${getDuration(pipeline.startedAt, pipeline.completedAt)}\n`);

  // Show per-package results
  for (const name of Object.keys(pipeline.results)) {
    const result = pipeline.results[name];
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.packageId}@${result.version}`);
    if (result.success) {
      console.log(`   NPM: ${result.npmUrl}`);
      if (result.gitTag) {
        console.log(`   Git: ${result.gitTag}`);
      }
    } else {
      result.errors.forEach(err => console.log(`   Error: ${err}`));
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Publish via GitHub Actions (Delegated, Auditable)
// ═════════════════════════════════════════════════════════════════════════

async function example5_PublishViaGitHubActions() {
  console.log('\n⚙️  EXAMPLE 5: Publish via GitHub Actions\n');

  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN environment variable required\n');
    return;
  }

  // Publish via GitHub Actions
  const pipeline = await publishController.publish({
    packageNames: ['@monodog/core'],
    packagePaths: { '@monodog/core': './packages/core' },
    method: 'github-actions', // ← Trigger GitHub Actions workflow
    dryRun: false,
    autoTag: true,
    createReleases: true, // ← Create GitHub releases
  });

  console.log(`\n✅ Published via GitHub Actions`);
  console.log(`Pipeline: ${pipeline.pipelineId}`);

  // If complete, show result
  if (pipeline.status === 'completed') {
    const result = pipeline.results['@monodog/core'];
    if (result?.gitHubReleaseUrl) {
      console.log(`GitHub Release: ${result.gitHubReleaseUrl}\n`);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Monitor Pipeline Progress
// ═════════════════════════════════════════════════════════════════════════

async function example6_MonitorPipeline() {
  console.log('\n📍 EXAMPLE 6: Monitor Pipeline Progress\n');

  // Start a publish pipeline
  let pipeline = await publishController.publish({
    packageNames: ['@monodog/core'],
    packagePaths: { '@monodog/core': './packages/core' },
    dryRun: false,
  });

  const pipelineId = pipeline.pipelineId;

  // Poll for status updates
  let isComplete = false;
  let pollCount = 0;

  while (!isComplete && pollCount < 30) {
    pipeline = publishController.getPipelineStatus(pipelineId)!;

    console.log(
      `[${new Date().toLocaleTimeString()}] ${pipeline.status.toUpperCase()} - ${pipeline.progress}% complete`
    );

    if (pipeline.status === 'completed' || pipeline.status === 'failed') {
      isComplete = true;
    } else {
      // Wait 2 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
      pollCount++;
    }
  }

  console.log(`\nFinal Status: ${pipeline.status.toUpperCase()}\n`);
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Use REST API (Recommended for Production)
// ═════════════════════════════════════════════════════════════════════════

async function example7_UseRestAPI() {
  console.log('\n🌐 EXAMPLE 7: Use REST API (Recommended)\n');

  console.log('This is how to use the release system from monodog-dashboard:\n');

  // Step 1: Check readiness
  console.log('Step 1: Check readiness');
  console.log('  POST /api/releases/check-readiness');
  console.log('  Request: { packageNames, packagePaths }');
  console.log('  Response: { canProceed, checks, summary }\n');

  // Step 2: Start publishing
  console.log('Step 2: Start publish');
  console.log('  POST /api/releases/start');
  console.log('  Request: { packageNames, packagePaths, method, dryRun }');
  console.log('  Response: { pipelineId }\n');

  // Step 3: Monitor progress
  console.log('Step 3: Monitor progress');
  console.log('  GET /api/releases/status/{pipelineId}');
  console.log('  Response: { status, progress, results }\n');

  // Step 4: Get details
  console.log('Step 4: Get final details');
  console.log('  GET /api/releases/details/{pipelineId}');
  console.log('  Response: { packages: [{ name, result }] }\n');
}

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 8: Custom Version Overrides
// ═════════════════════════════════════════════════════════════════════════

async function example8_CustomVersions() {
  console.log('\n🔧 EXAMPLE 8: Custom Version Overrides\n');

  // Manually specify versions instead of auto-detection
  const pipeline = await publishController.publish({
    packageNames: ['@monodog/core'],
    packagePaths: { '@monodog/core': './packages/core' },
    versionMap: {
      '@monodog/core': '2.0.0', // ← Override auto-detected version
    },
    dryRun: true,
  });

  console.log(`\nWill publish @monodog/core at version 2.0.0 (custom override)\n`);
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════

function getDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt || !completedAt) return 'N/A';
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  return `${seconds}s`;
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN - RUN EXAMPLES
// ═════════════════════════════════════════════════════════════════════════

async function main() {
  const examples = process.argv[2];

  switch (examples) {
    case '1':
      await example1_CheckReadiness();
      break;
    case '2':
      await example2_AnalyzeChanges();
      break;
    case '3':
      await example3_DryRunPublish();
      break;
    case '4':
      await example4_PublishViaNode();
      break;
    case '5':
      await example5_PublishViaGitHubActions();
      break;
    case '6':
      await example6_MonitorPipeline();
      break;
    case '7':
      await example7_UseRestAPI();
      break;
    case '8':
      await example8_CustomVersions();
      break;
    default:
      console.log(`
INDEPENDENT RELEASE ENGINE - QUICK START EXAMPLES

Available Examples:
  1. Check Release Readiness
  2. Analyze Changes for Package
  3. Dry-Run Publish
  4. Publish via Node.js (Direct)
  5. Publish via GitHub Actions
  6. Monitor Pipeline Progress
  7. Use REST API
  8. Custom Version Overrides

Usage:
  npx ts-node quick-start.ts <example-number>

Examples:
  npx ts-node quick-start.ts 1    # Check readiness
  npx ts-node quick-start.ts 3    # Dry-run before real publish
  npx ts-node quick-start.ts 4    # Actually publish
      `);
  }
}

main();
