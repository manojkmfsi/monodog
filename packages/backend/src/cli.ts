#!/usr/bin/env node

/**
 * CLI Entry Point for the Monorepo Analysis Engine.
 * * This script is executed when a user runs the `monodog-cli` command
 * in their project. It handles command-line arguments to determine
 * whether to:
 * 1. Start the API server for the dashboard.
 * 2. Run a one-off analysis command. (Future functionality)
 */

import * as path from 'path';
import { startServer } from './index'; // Assume index.ts exports this function

// --- Argument Parsing ---

// 1. Get arguments excluding the node executable and script name
const args = process.argv.slice(2);

// Default settings
let serve = false;
let rootPath = process.cwd(); // Default to the current working directory

// Simple argument parsing loop
for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--serve') {
        serve = true;
    } else if (arg === '--root') {
        // Look at the next argument for the path
        if (i + 1 < args.length) {
            rootPath = path.resolve(args[i + 1]);
            i++; // Skip the next argument since we've consumed it
        } else {
            console.error('Error: --root requires a path argument.');
            process.exit(1);
        }
    } else if (arg === '-h' || arg === '--help') {
        console.log(`
Monodog CLI - Monorepo Analysis Engine

Usage:
  monodog-cli [options]

Options:
  --serve            Start the Monorepo Dashboard API server (default: off).
  --root <path>      Specify the root directory of the monorepo to analyze (default: current working directory).
  -h, --help         Show this help message.

Example:
  monodog-cli --serve --root /path/to/my/monorepo
        `);
        process.exit(0);
    }
}

// --- Execution Logic ---

if (serve) {
    console.log(`Starting Monodog API server...`);
    console.log(`Analyzing monorepo at root: ${rootPath}`);
    // Start the Express server and begin analysis
    startServer(rootPath);
} else {
    // Default mode: print usage or run a default report if no command is specified
    console.log(`Monodog CLI: No operation specified. Use --serve to start the API or -h for help.`);
}
