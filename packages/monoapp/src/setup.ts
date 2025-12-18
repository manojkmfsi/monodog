#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('\n🚀 Initializing Monodog...\n');

// ---------------------------------
// Resolve paths
// ---------------------------------
const cwd = process.cwd();              // where user ran the command
const destinationPath = path.join(cwd, 'monodog');

// IMPORTANT: resolve the installed package root
const packageRoot = path.resolve(__dirname, '..');

// ---------------------------------
// Guards
// ---------------------------------
if (fs.existsSync(destinationPath)) {
  console.log(`⚠️ monodog already exists in this directory.`);
  process.exit(0);
}

if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
  console.error('❌ Failed to resolve Monodog package root.');
  process.exit(1);
}

// ---------------------------------
// Copy whole package
// ---------------------------------
console.log(`📁 Copying Monodog into ${destinationPath}...`);

fs.cpSync(packageRoot, destinationPath, {
  recursive: true,
  dereference: true,
  filter: (src) => {
    const name = path.basename(src);
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
