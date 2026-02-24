const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Load config similar to the app
let databasePath = 'file:./monodog.db'; // default

// Try to read monodog-config.json
try {
  const configPath = path.join(__dirname, 'monodog-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    databasePath = config.database?.path || databasePath;
  }
} catch (e) {
  console.warn('Could not read config:', e.message);
}

console.log(`Database URL: ${databasePath}\n`);

async function checkDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databasePath,
      },
    },
  });

  try {
    console.log('=== Database Status ===\n');

    // Check ReleasePipeline count
    const pipelineCount = await prisma.releasePipeline.count();
    console.log(`Total pipelines in database: ${pipelineCount}\n`);

    if (pipelineCount > 0) {
      const pipelines = await prisma.releasePipeline.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      console.log('Latest pipelines:');
      pipelines.forEach(p => {
        console.log(`  - ${p.packageName} v${p.releaseVersion} (${p.currentStatus})`);
        console.log(`    Triggered by: ${p.triggeredBy} at ${p.triggeredAt}`);
        console.log(`    Owner/Repo: ${p.owner}/${p.repo}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
