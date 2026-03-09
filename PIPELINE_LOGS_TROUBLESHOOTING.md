# Pipeline Logs Not Showing - Troubleshooting Guide

## Quick Diagnosis

Run the test script to check database and logging system:

```bash
cd /home/manoj/Documents/mjdog
node test-pipeline-logging.js
```

This will verify:

- ✅ Database exists and is accessible
- ✅ Prisma client can connect
- ✅ PipelineLog table exists
- ✅ Recent logs (if any exist)
- ✅ Publishing pipelines created

---

## Common Issues & Solutions

### Issue 1: Database Not Initialized

**Symptoms:**

- `Failed to fetch logs` in dashboard
- Database file doesn't exist

**Solution:**

```bash
cd /home/manoj/Documents/mjdog/packages/monoapp

# Regenerate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Check database
npx prisma studio
```

---

### Issue 2: No Logs in Database (Database is empty)

**Symptoms:**

- Dashboard loads but shows "No logs found"
- Test script shows 0 logs

**Causes:**

- Release workflow hasn't been triggered yet
- publishController.publish() wasn't called

**Solution:**

**Option A: Manually trigger workflow to create test logs**

1. Go to: https://github.com/manojkmfsi/monodog/actions
2. Select: "Monodog Release Workflow"
3. Click: "Run workflow"
4. Workflow will auto-trigger and create logs

**Option B: Create test logs programmatically**

```bash
cd /home/manoj/Documents/mjdog/packages/monoapp

# Create test data
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Create test pipeline
  const pipeline = await prisma.publishPipeline.create({
    data: {
      id: 'test-pipeline-' + Date.now(),
      packageNames: '[\"@monodog/test\"]',
      method: 'test',
      status: 'completed',
      triggeredBy: 'test-user',
      triggeredAt: new Date(),
    }
  });

  // Create test logs
  for (let i = 0; i < 5; i++) {
    await prisma.pipelineLog.create({
      data: {
        publishPipelineId: pipeline.id,
        packageName: '@monodog/test',
        stage: ['validation', 'publishing', 'completion'][i % 3],
        level: ['info', 'info', 'info', 'warning', 'info'][i],
        message: \`Test log entry \${i + 1}\`,
        details: JSON.stringify({ test: true, index: i }),
        timestamp: new Date(Date.now() - (5 - i) * 60000),
      }
    });
  }

  console.log('✅ Created test pipeline with 5 logs');
  console.log('📊 Pipeline ID:', pipeline.id);
  await prisma.\$disconnect();
})();
"
```

Then refresh `/pipeline?tab=logs` to see test logs.

---

### Issue 3: Logs in Database but Not Showing in Dashboard

**Symptoms:**

- Test script shows logs exist
- Dashboard still shows "No logs found"

**Causes:**

- API endpoint not being called
- Auth token missing
- Wrong query URL

**Solutions:**

**Check 1: Verify API endpoint is accessible**

```bash
# In browser console (when dashboard is open):
fetch('/api/pipelines/logs/recent', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json()).then(console.log)
```

If you get 401, auth is needed. If you get 403, check permissions.

**Check 2: Verify browser console for errors**

1. Open: http://localhost:3000/pipeline
2. Press: F12 or Right-click → Inspect
3. Go to: Console tab
4. Look for red errors
5. Check Network tab for failed requests

**Check 3: Verify API is running**

```bash
# Another terminal
cd /home/manoj/Documents/mjdog/packages/monoapp
npm run dev

# Should show:
# ✅ Server running on http://localhost:3000
# ✅ API listening on port 3001 (or similar)
```

---

### Issue 4: Logs Show But Look Empty/Incomplete

**Symptoms:**

- Logs show in dashboard
- Messages are blank
- Missing stage/level info

**Causes:**

- Logs created before schema was finalized
- Prisma client wasn't properly initialized during logging

**Solutions:**

1. **Clear and regenerate logs:**

   ```bash
   # Delete old logs (starts fresh)
   cd packages/monoapp
   npx prisma studio
   # Delete PipelineLog records manually or run:
   npx prisma db execute --stdin << 'SQL'
   DELETE FROM PipelineLog;
   SQL
   ```

2. **Trigger fresh workflow:**
   - Push a new commit to main
   - Workflow auto-triggers
   - New complete logs will be created

---

## Step-by-Step Verification Process

### 1. Check Workflow Triggers

```bash
cd /home/manoj/Documents/mjdog

# Make a test commit that triggers the workflow
echo "# Test $(date)" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "test: trigger workflow"
git push origin main
```

Then go to: https://github.com/manojkmfsi/monodog/actions

You should see **Monodog Release Workflow** running.

### 2. Check Logs Were Created

Wait 2-3 minutes for workflow to complete, then:

```bash
node test-pipeline-logging.js
```

You should see logs in the output.

### 3. Start Dashboard

```bash
cd packages/monoapp
npm run dev
```

Wait for server to start (listen logs), then:

Open: http://localhost:3000/pipeline?tab=logs

You should see logs displayed.

---

## Quick Reference: API Endpoints

These endpoints should work when authenticated:

| Endpoint                                   | Purpose                    |
| ------------------------------------------ | -------------------------- |
| `GET /api/pipelines/logs/recent`           | All recent logs            |
| `GET /api/pipelines/:id/logs`              | Logs for specific pipeline |
| `GET /api/pipelines/:id/logs/stage/:stage` | Filter by stage            |
| `GET /api/pipelines/:id/logs/errors`       | Error logs only            |

---

## Debug Mode: Enable Verbose Logging

Add this to `.env.local` in `packages/monoapp`:

```env
DEBUG=*
NODE_ENV=development
DATABASE_URL=file:./dev.db
```

Then restart server and check console for detailed logs.

---

## Still Not Working?

1. **Run the test script:**

   ```bash
   node test-pipeline-logging.js
   ```

   Share the output - it will pinpoint the issue.

2. **Check Prisma Studio:**

   ```bash
   cd packages/monoapp
   npx prisma studio
   ```

   Verify data is actually in database.

3. **Check browser DevTools:**
   - Network tab: See actual API responses
   - Console: See JavaScript errors
   - Application: Check localStorage/auth token

4. **Check logs directly in SQLite:**
   ```bash
   cd packages/monoapp
   sqlite3 prisma/dev.db "SELECT COUNT(*) FROM PipelineLog;"
   ```

---

## Expected Flow

```
1. Release workflow triggered (automatic on push)
   ↓
2. Workflow runs (1-2 minutes)
   ↓
3. publishController.publish() called
   ↓
4. pipelineLogger.info/error() creates entries
   ↓
5. Logs stored in PipelineLog table
   ↓
6. API /pipelines/logs/recent fetches them
   ↓
7. Frontend renders in /pipeline?tab=logs
   ↓
8. ✅ Visible in dashboard
```

If any step fails, the logs won't appear. The test script helps identify which step failed.

---

**Questions?** Check:

- Was workflow triggered? (GitHub Actions tab)
- Do logs exist? (test-pipeline-logging.js)
- Is API working? (browser console Network tab)
- Is auth working? (check token in localStorage)
