// /**
//  * Semantic Release configuration for a single package within a pnpm monorepo.
//  * This configuration replaces the standard @semantic-release/npm plugin's
//  * 'prepare' and 'publish' steps with pnpm commands via the @semantic-release/exec plugin
//  * to avoid the "Cannot read properties of null (reading 'name')" error.
//  */
// module.exports = {
//   // Use the default commit analyzer and release notes generator
//   plugins: [
//     "@semantic-release/commit-analyzer",
//     "@semantic-release/release-notes-generator",

//     // --- FIX for pnpm ERROR ---
//     // Instead of using the default "@semantic-release/npm", which fails
//     // when running "npm version" in a pnpm workspace, we use @semantic-release/exec.
//     [
//       "@semantic-release/exec",
//       {
//         // 1. Prepare Step (Versioning)
//         // Runs 'pnpm version' to update the package.json with the new version.
//         // We use --no-git-tag-version because @semantic-release/git handles tags later.
//         "prepareCmd": "pnpm version ${nextRelease.version} --no-git-tag-version --allow-same-version",

//         // 2. Publish Step
//         // Runs 'pnpm publish' to publish the package to the registry.
//         "publishCmd": "pnpm publish"
//       }
//     ],

//     // 3. Git Step
//     // This plugin commits the updated package.json (from the prepareCmd)
//     // and creates the Git tag for the release.
//     [
//       "@semantic-release/git",
//       {
//         "assets": ["package.json"], // Ensure the version bump is committed
//         "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
//       }
//     ]
//   ]
// };
