/**
 * Test Pipeline Logging System
 * Run: node test-pipeline-logging.js from /home/manoj/Documents/mjdog
 */

const path = require('path');
const fs = require('fs');

async function testPipelineLogging() {
  try {
    console.log('🧪 Testing Pipeline Logging System\n');
    console.log('═'.repeat(50));

    // Step 1: Check if database exists
    console.log('\n1️⃣ Checking database...');
    const dbPath = path.join(__dirname, 'packages/monoapp/prisma/dev.db');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`   ✅ Database exists: ${dbPath}`);
      console.log(`   📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`   ❌ Database NOT found: ${dbPath}`);
      console.log('   💡 Run: cd packages/monoapp && npx prisma migrate dev');
      return;
    }

    // Step 2: Check if Prisma client can initialize
    console.log('\n2️⃣ Checking Prisma client...');
    process.chdir(path.join(__dirname, 'packages/monoapp'));

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      // Try a simple query
      const pipelineCount = await prisma.publishPipeline.count();
      console.log(`   ✅ Prisma client initialized`);
      console.log(`   📊 Pipelines in DB: ${pipelineCount}`);

      // Step 3: Check pipeline logs
      console.log('\n3️⃣ Checking pipeline logs table...');
      const logCount = await prisma.pipelineLog.count();
      console.log(`   ✅ PipelineLog model accessible`);
      console.log(`   📊 Logs in DB: ${logCount}`);

      if (logCount > 0) {
        // Show recent logs
        const recentLogs = await prisma.pipelineLog.findMany({
          take: 5,
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            stage: true,
            level: true,
            message: true,
            timestamp: true,
          },
        });

        console.log('\n4️⃣ Recent logs:');
        recentLogs.forEach((log, i) => {
          console.log(
            `   ${i + 1}. [${log.level.toUpperCase()}] ${log.stage}: ${log.message}`
          );
          console.log(`      Time: ${log.timestamp}`);
        });
      } else {
        console.log('\n⚠️  No logs found in database yet');
        console.log('   💡 Logs are created when:');
        console.log(
          '      - Release process runs with publishController.publish()'
        );
        console.log('      - Workflow is triggered automatically on push');
      }

      // Step 4: Check for publishing pipelines
      console.log('\n5️⃣ Checking publish pipelines...');
      const pipelines = await prisma.publishPipeline.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          packageNames: true,
          status: true,
          method: true,
          createdAt: true,
        },
      });

      if (pipelines.length > 0) {
        console.log('   Recent pipelines:');
        pipelines.forEach((p, i) => {
          console.log(`   ${i + 1}. [${p.status}] ${p.packageNames}`);
        });
      } else {
        console.log('   ℹ️  No pipelines yet');
      }

      // Step 5: Check API availability
      console.log('\n6️⃣ Checking API availability...');
      console.log('   When app is running, test:');
      console.log('   - GET /api/pipelines/logs/recent');
      console.log('   - Requires auth token in headers');

      await prisma.$disconnect();

      console.log('\n' + '═'.repeat(50));
      console.log('✅ Database setup looks good!\n');
      console.log('Next steps:');
      console.log('1. 📱 Start dashboard: npm run dev');
      console.log('2. 🔄 Trigger release workflow');
      console.log('3. 📊 Check /pipeline?tab=logs');
    } catch (err) {
      console.log(`   ❌ Prisma error: ${err.message}`);
      if (
        err.message.includes('Missing') ||
        err.message.includes('not generated')
      ) {
        console.log('\n   💡 Fix: Run `npx prisma generate`');
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testPipelineLogging();
