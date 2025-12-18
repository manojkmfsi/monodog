#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
console.log('\n🚀 Initializing Monodog...\n');
// ---------------------------------
// Resolve paths
// ---------------------------------
const cwd = process.cwd(); // where user ran the command
const destinationPath = path_1.default.join(cwd, 'monodog');
// IMPORTANT: resolve the installed package root
const packageRoot = path_1.default.resolve(__dirname, '..');
// ---------------------------------
// Guards
// ---------------------------------
if (fs_1.default.existsSync(destinationPath)) {
    console.log(`⚠️ monodog already exists in this directory.`);
    process.exit(0);
}
if (!fs_1.default.existsSync(path_1.default.join(packageRoot, 'package.json'))) {
    console.error('❌ Failed to resolve Monodog package root.');
    process.exit(1);
}
// ---------------------------------
// Copy whole package
// ---------------------------------
console.log(`📁 Copying Monodog into ${destinationPath}...`);
fs_1.default.cpSync(packageRoot, destinationPath, {
    recursive: true,
    dereference: true,
    filter: (src) => {
        const name = path_1.default.basename(src);
        return ![
            'node_modules',
            '.git',
            '.turbo',
            '.pnpm',
            '.cache',
            'dist/.tsbuildinfo',
        ].includes(name);
    },
});
console.log(`
✅ Monodog setup complete!

Next steps:
  cd monodog
  pnpm install
  pnpm serve
`);
