#!/usr/bin/env node

/**
 * CLI Entry Point for the Monorepo Analysis Engine.
 * * This script is executed when a user runs the `monodog-cli` command
 * in their project. It handles command-line arguments to determine
 * whether to:
 * 1. Start the API server for the dashboard.
 * 2. Run a one-off analysis command. (Future functionality)
 */
import * as fs from 'fs';

import * as path from 'path';

import { appConfig } from './config-loader';

  // const appConfig = loadConfig();

const rootPath = path.resolve(appConfig.workspace.root_dir ?? process.cwd()); // Default to the current working directory

      copyPackageToWorkspace(rootPath);

/**
 * Copies an installed NPM package from node_modules into the local install_path workspace directory.
 */
function copyPackageToWorkspace(rootDir: string): void  {
    // 1. Get package name from arguments
    // The package name is expected as the first command-line argument (process.argv[2])
    const packageName = process.argv[2];

    if (!packageName || packageName.startsWith('--')) {
        console.error("Error: Please provide the package name as an argument if you want to setup dashboard.");
        console.log("Usage: pnpm monodog-cli @monodog/dashboard --serve --root .");
    }
    // if(!(packageName == '@monodog/backend' || packageName == '@monodog/dashboard')){
    //     console.log("\n--- Skipping workspace setup for @monodog/backend to avoid self-copying. ---");
    //     return;
    // }

    // const rootDir = process.cwd();
    const sourcePath = path.join(rootDir, 'node_modules', packageName);

    // Convert package name to a valid folder name (e.g., @scope/name -> scope-name)
    // This is optional but makes file paths cleaner.
    const folderName = packageName.replace('@', '').replace('/', '-');
    const destinationPath = path.join(rootDir, appConfig.workspace.install_path, folderName);

    console.log(`\n--- Monorepo Workspace Conversion ---`);
    console.log(`Target Package: ${packageName}`);
    console.log(`New Workspace:  ${appConfig.workspace.install_path}/${folderName}`);
    console.log(`-----------------------------------`);


    // 2. Validate Source existence
    if (!fs.existsSync(sourcePath)) {
        console.error(`\n❌ Error: Source package not found at ${sourcePath}.`);
        console.error("Please ensure the package is installed via 'pnpm install <package-name>' first.");
        process.exit(1);
    }

    // 3. Validate Destination existence (prevent accidental overwrite)
    if (fs.existsSync(destinationPath)) {
        console.error(`\n❌ Error: Destination directory already exists at ${destinationPath}.`);
        console.error("Please manually remove it or rename it before running the script.");
        process.exit(1);
    }

    // Ensure the 'install_path' directory exists
    const packagesDir = path.join(rootDir, appConfig.workspace.install_path);
    if (!fs.existsSync(packagesDir)) {
        fs.mkdirSync(packagesDir, { recursive: true });
        console.log(`Created ${appConfig.workspace.install_path} directory: ${packagesDir}`);
    }

    // 4. Perform the copy operation
    try {
        console.log(`\nCopying files from ${sourcePath} to ${destinationPath}...`);

        // fs.cpSync provides cross-platform recursive copying (Node 16.7+)
        fs.cpSync(sourcePath, destinationPath, {
            recursive: true,
            dereference: true,
            // Filter out node_modules inside the package itself to avoid deep recursion
            // filter: (src: string): boolean => !src.includes('node_modules'),
        });

        console.log(`\n✅ Success! Contents of '${packageName}' copied to '${destinationPath}'`);

        // Post-copy instructions
        console.log("\n*** IMPORTANT NEXT STEPS (MANDATORY) ***");
        console.log("1.Migrate Database:");
        console.log(`   - pnpm prisma migrate --schema ./node_modules/@monodog/backend/prisma/schema.prisma`);
        console.log("2. Generate Client:");
        console.log(`   - pnpm exec prisma generate --schema ./node_modules/@monodog/backend/prisma/schema.prisma`);
        console.log("3. Run Backend app server with dashboard setup");
        console.log(`   - pnpm monodog-cli @monodog/dashboard --serve --root .`);

    } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Failed to copy files: ${message}`);
    process.exit(1);
  }
}

// function createConfigFileIfMissing(rootPath: string): void {
// // --- CONFIGURATION ---
// const configFileName = 'monodog-conf.json';
// const configFilePath = path.resolve(rootPath, configFileName);

// // The default content for the configuration file
// const defaultContent = {
//   "workspace": {
//     "root_dir": "./",  // Relative to where the config file is located
//     "install_path":"packages" // Where to install monodog packages
//   },
//   "database": {
//     "path": "./monodog.db" // SQLite database file path, relative to prisma schema location
//   },
//   "dashboard": {
//     "host": "0.0.0.0",
//     "port": "3999"
//   },
//   "server": {
//     "host": "0.0.0.0", // Default host for the API server
//     "port": DEFAULT_PORT // Default port for the API server
//   }
// };

// const contentString = JSON.stringify(defaultContent, null, 2);
// // ---------------------

// console.log(`\n[monodog] Checking for ${configFileName}...`);

// if (fs.existsSync(configFilePath)) {
//   console.log(`[monodog] ${configFileName} already exists. Skipping creation.`);
// } else {
//   try {
//     // Write the default content to the file
//     fs.writeFileSync(configFilePath, contentString, 'utf-8');
//     console.log(`[monodog] Successfully generated default ${configFileName} in the workspace root.`);
//     console.log('[monodog] Please review and update settings like "host" and "port".');
//   } catch (err: unknown) {
//     const message = err instanceof Error ? err.message : String(err);
//     console.error(`[monodog Error] Failed to generate ${configFileName}:`, message);
//     process.exit(1);
//   }
// }
// }

