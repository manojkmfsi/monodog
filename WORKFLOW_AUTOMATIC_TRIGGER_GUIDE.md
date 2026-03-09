# Monodog Release Workflow - Automatic Trigger Guide

## Overview

The GitHub Actions workflow now **automatically triggers** when publish-related changes are detected to main branch:

- ✅ Automatic trigger on package version changes
- ✅ Detects CHANGELOG and .changeset modifications
- ✅ Logs publish events to database in real-time
- ✅ Full error handling with graceful degradation
- ✅ No manual configuration needed

## How It Works

### Workflow Trigger

**File:** `.github/workflows/monodog-release.yaml`

**Trigger Event:** `push` to `main` branch

**Trigger Paths:** Workflow activates when changes occur to:

```
- packages/*/package.json
- packages/*/CHANGELOG.md
- libs/*/package.json
- CHANGELOG.md
- .changeset/**
```

### Workflow Steps

1. **Checkout** - Clone repository with full history
2. **Setup** - Node.js 20, pnpm 8, dependencies
3. **Detect Publish** - Analyze commit for publish-related changes
4. **Log Event** - If publish detected, log to database
5. **Complete** - Report workflow status

## When the Workflow Runs

### Automatic Triggers ✅

The workflow automatically runs when:

1. **Package Version Updated**

   ```
   git add packages/ci-status/package.json
   git commit -m "chore: release @monodog/ci-status@1.0.5"
   git push origin main
   ```

   ➜ Workflow triggers automatically

2. **Changelog Modified**

   ```
   git add CHANGELOG.md packages/ci-status/CHANGELOG.md
   git commit -m "docs: update changelog"
   git push origin main
   ```

   ➜ Workflow triggers automatically

3. **Changesets Added**
   ```
   git add .changeset/fix-1234.md
   git commit -m "chore: add changeset"
   git push origin main
   ```
   ➜ Workflow triggers automatically

### No Trigger ❌

Workflow does NOT run for:

- README updates
- Source code changes
- Workflow file changes (unless paired with package.json change)
- Direct commits to non-main branches
- Comments-only commits

## Setup & Testing

### Step 1: Verify Workflow Configuration

1. Go to: https://github.com/manojkmfsi/monodog/actions
2. Select: **Monodog Release Workflow**
3. Check that workflow is **enabled** (toggle in upper right)

### Step 2: Test with Package Update

Create a test commit that triggers the workflow:

```bash
cd /home/manoj/Documents/mjdog

# Make a minor change to trigger workflow
echo "# Test commit $(date)" >> CHANGELOG.md

# Commit and push
git add CHANGELOG.md
git commit -m "test: workflow trigger test"
git push origin main
```

### Step 3: Monitor Execution

1. Go to: https://github.com/manojkmfsi/monodog/actions
2. Watch for **Monodog Release Workflow** run to start
3. Click the run to see real-time logs
4. Look for "Detecting publish changes" step

### Step 4: Verify Logging

Check logs were saved to database:

```bash
cd /home/manoj/Documents/mjdog/packages/monoapp

# View database
npx prisma studio

# Browse tables:
# - PublishPipeline (workflow runs)
# - PipelineLog (detected events)
```

## Real-World Usage

### When Publishing a Package

1. **Run publish locally:**

   ```bash
   cd /home/manoj/Documents/mjdog
   pnpm changeset
   pnpm changeset version
   ```

2. **Push changes:**

   ```bash
   git push origin main
   ```

3. **Workflow automatically:**
   - Detects package.json and CHANGELOG changes
   - Runs on GitHub Actions
   - Logs publish detection event
   - Updates pipeline status

4. **Monitor progress:**
   - Watch: https://github.com/manojkmfsi/monodog/actions
   - Dashboard: http://localhost:3000/pipeline?tab=logs

## Troubleshooting

### Issue: Workflow didn't run after pushing

**Possible causes:**

- Commit didn't modify watched paths (check the list)
- Workflow is disabled (check Action tab)
- Commit is on wrong branch (must be `main`)

**Solution:**

```bash
# Force trigger by updating package.json
echo "" >> packages/monoapp/package.json
git add packages/monoapp/package.json
git commit -m "chore: trigger workflow"
git push origin main
```

### Issue: Logs not appearing in `/pipeline`

**Cause:** Database not running or Prisma client not generated

**Solution:**

```bash
cd packages/monoapp
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Issue: Workflow runs but shows errors

Check the workflow logs for:

- Prisma client generation failures
- Database connection issues
- Missing environment variables

## Log Output Example

### Workflow Console Output

```
🔍 Detecting publish changes in commit...
📝 Commit message: chore: update changelogs and versions

📋 Changed files:
packages/ci-status/package.json
packages/ci-status/CHANGELOG.md
CHANGELOG.md

✅ Detected publish-related changes

📊 Logging publish event to database...
📦 Loading pipeline logger...
✅ Pipeline logger loaded
📌 Commit SHA: a1b2c3d
👤 Actor: john-dev

📝 Logging publish detection event...
✅ Event logged with pipeline ID: auto-detect-a1b2c3d-1678356789123

📊 Summary:
  Pipeline ID: auto-detect-a1b2c3d-1678356789123
  Event Type: Publish Detection
  Commit: a1b2c3d
  Status: Logged Successfully
```

### Dashboard Display

Pipeline Logs tab shows:

- **Stage:** detection
- **Level:** info
- **Message:** "Automatic publish detection triggered by commit a1b2c3d"
- **Timestamp:** YYYY-MM-DD HH:MM:SS
- **Details:** Commit SHA, message, actor

## Performance

- **Detection time:** ~2-3 minutes
- **Logging overhead:** <1 second
- **Database impact:** Minimal (1 pipeline record + 1-2 log entries)

## Files

- **Workflow:** `.github/workflows/monodog-release.yaml`
- **Logging Service:** `packages/monoapp/src/services/pipeline-logger.ts`
- **Database Model:** `packages/monoapp/prisma/schema/publish-pipeline.prisma`
- **Dashboard UI:** `monodog-dashboard/src/components/pipeline/PipelineLogs.tsx`

## Environment Variables

Workflow uses these environment variables:

- `DATABASE_URL` - SQLite database path
- `GITHUB_SHA` - Commit SHA (automatic)
- `GITHUB_ACTOR` - User who pushed (automatic)
- `GITHUB_TOKEN` - GitHub API access (automatic)

## What Gets Logged

When workflow detects a publish commit, it logs:

```json
{
  "pipelineId": "auto-detect-a1b2c3d-1678356789123",
  "stage": "detection",
  "message": "Automatic publish detection triggered by commit a1b2c3d",
  "commitSha": "a1b2c3d1234567890abcdef",
  "commitMessage": "chore: update changelogs",
  "triggeredBy": "john-dev",
  "timestamp": "2026-03-09T10:30:45Z"
}
```

## Next Steps

1. **Test workflow:** Push a commit with package changes
2. **Monitor:** Watch GitHub Actions and dashboard
3. **View logs:** Check `/pipeline?tab=logs` for events
4. **Integrate:** Use for automated publish detection

---

**Generated:** March 9, 2026  
**Status:** Automatic Trigger Active
