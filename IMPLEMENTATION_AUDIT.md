# Implementation Audit: Changeset & Publishing Requirements

## Requirements Checklist

### ❌ 1. Use @changesets/cli and @changesets/apply-release-plan

**Status:** PARTIALLY COMPLIANT - ISSUES FOUND

**Current State:**
- ✅ `@changesets/cli` is installed and configured in root `package.json`
- ✅ `@changesets/changelog-github` is configured
- ✅ `.changeset/config.json` exists with proper configuration
- ✅ GitHub Actions workflow uses `changesets/action@v1.4.1`
- ❌ `@changesets/apply-release-plan` is NOT actively used in the pipeline
- ❌ Backend is manually creating changeset files instead of using `@changesets/cli`

**Issues:**
1. **Manual Changeset Generation:** The backend creates `.md` files manually in [src/services/changeset-service.ts](src/services/changeset-service.ts#L154) with custom formatting
   - Should use: `npx changeset add --empty` then edit, OR use proper changeset format
   - Current approach bypasses changeset validation

2. **Missing @changesets/apply-release-plan:** This package should be used in CI to:
   - Read changesets
   - Update package.json versions
   - Update CHANGELOG.md
   - Remove changeset files after processing
   - Currently: GitHub Actions uses `changesets/action` which handles this internally

**Recommendation:**
```typescript
// INSTEAD OF manual file creation, use:
await execPromise('pnpm changeset add --empty', { cwd: rootPath });
// Then update the generated file with proper format
```

---

### ❌ 2. pnpm is used only as executor, not as release logic

**Status:** PARTIALLY COMPLIANT - CONCERNS FOUND

**Current State:**
- ✅ GitHub Actions uses pnpm as executor
- ✅ Backend doesn't have release logic in Node.js
- ❌ Backend DOES have custom Git/push logic that should be delegated to CI
- ❌ Backend attempts to trigger GitHub Actions (should be automatic via push)

**Issues:**
1. **Backend Has Publishing Logic:** [src/services/changeset-service.ts](src/services/changeset-service.ts#L229) has `triggerPublishPipeline()` that:
   - Commits changesets: `git commit -m "chore: publish changeset"`
   - Pushes to origin: `git push origin [branch]`
   - Tries to trigger GitHub Actions API
   - **This violates the principle**: pnpm should be the ONLY executor in CI

2. **What SHOULD happen:**
   - Backend creates changeset file ONLY
   - Push triggering should be automatic (GitHub Actions runs on `push: main`)
   - No need for manual workflow dispatch API call

**Current Flow (WRONG):**
```
Frontend -> Backend creates changeset -> Backend commits -> Backend pushes -> Backend triggers API
```

**Should Be:**
```
Frontend -> Backend creates changeset -> Commit/push via CI/CD -> GitHub Actions runs automatically
```

---

### ❌ 3. Changeset commits must follow a standardized format

**Status:** PARTIALLY COMPLIANT - WRONG FORMAT USED

**Current State:**
- ✅ commitlint.config.js defines conventional commit format
- ✅ Husky hooks enforce format on manual commits
- ❌ Backend commit message is: `"chore: publish changeset"`
- ❌ Should be: `"chore(release): changeset publish"` or similar with proper scope

**Issues:**9 unpublished changeset(s) detected

Consider reviewing existing changesets before creating new ones
1. **Commit in [triggerPublishPipeline()](src/services/changeset-service.ts#L260):**
   ```typescript
   'git commit -m "chore: publish changeset" --no-verify'
   //                                          ^^^^^^^^^^
   //                    PROBLEM: --no-verify bypasses commitlint!
   ```

2. **Correct Format Should Be:**
   ```typescript
   'git commit -m "chore(release): add changeset [SKIP CI]"'
   // - Proper scope: (release)
   // - [SKIP CI] to prevent infinite loops
   // - NO --no-verify (should pass linting)
   ```

**Recommendation:**
- Change commit message format to match `commitlint.config.js` scope-enum
- Remove `--no-verify` flag
- Add `[SKIP CI]` to prevent recursive workflows

---

### ❌ 4. npm token must never be exposed to frontend or logs

**Status:** PARTIALLY COMPLIANT - CAREFUL BUT NOT PERFECT

**Current State:**
- ✅ NPM_TOKEN is in GitHub Actions secrets (NOT exposed to frontend)
- ✅ Frontend never sees token (only backend creates changesets)
- ❌ Token IS passed to GitHub Actions environment (necessary but risky)
- ❌ Logs might expose token if error occurs

**Issues:**
1. **AppLogger calls in [triggerPublishPipeline()](src/services/changeset-service.ts#L229-L330):**
   ```typescript
   AppLogger.info(`Pushed changeset to ${currentBranch}`);
   AppLogger.warn(`Failed to push: ${pushError}`);
   ```
   - If `pushError` contains token, it WILL be logged
   - `execPromise()` might include token in error messages

2. **GitHub API Token:**
   ```typescript
   const githubToken = process.env.GITHUB_TOKEN;
   if (githubToken) {
     // ... API call with token ...
     AppLogger.info('GitHub workflow triggered successfully');
   }
   ```
   - GOOD: Token is NOT logged directly
   - CONCERN: Error responses might contain sensitive info

**Recommendations:**
1. Sanitize error messages:
   ```typescript
   catch (pushError) {
     const sanitizedError = String(pushError).replace(/token|secret|auth/gi, '***');
     AppLogger.warn(`Failed to push: ${sanitizedError}`);
   }
   ```

2. Use `--no-verify` cautiously - remove it and ensure commit passes linting

3. Set `NPM_TOKEN` in `.npmrc` during CI only (GitHub Actions already does this)

---

## Summary of Violations

| Requirement | Status | Severity | Action |
|------------|--------|----------|--------|
| Use @changesets/cli | ⚠️ PARTIAL | HIGH | Use CLI instead of manual file creation |
| Use @changesets/apply-release-plan | ❌ MISSING | HIGH | Let GitHub Actions handle it |
| pnpm executor only | ⚠️ PARTIAL | HIGH | Remove backend publish logic, let CI run on push |
| Standardized commit format | ❌ WRONG | MEDIUM | Fix commit message and remove --no-verify |
| npm token security | ⚠️ CAREFUL | MEDIUM | Sanitize error logs, remove token from output |

---

## Action Items

### IMMEDIATE (CRITICAL)

1. **Refactor Backend Publishing Logic:**
   - Remove `triggerPublishPipeline()` function
   - Backend should ONLY: create changeset file
   - Remove all Git commit/push/API trigger logic
   - Remove --no-verify flag

2. **Fix Commit Message:**
   - Change: `"chore: publish changeset"`
   - To: `"chore(release): publish changeset [SKIP CI]"`

3. **Update GitHub Actions Workflow:**
   - Change: Push in backend and trigger API
   - To: Simply commit and push (GitHub Actions will run automatically)
   - Make sure `.github/workflows/release.yml` has `on: push` trigger

### FOLLOW-UP (IMPORTANT)

1. **Use Changesets CLI Properly:**
   - Use `pnpm changeset add` for prompts
   - Use `pnpm changeset version` to update versions
   - Use `pnpm changeset publish` to publish

2. **Log Sanitization:**
   - Remove sensitive data from error logs
   - Review all AppLogger calls in changeset-service.ts

3. **Configuration Review:**
   - Verify `.changeset/config.json` matches your needs
   - Consider `commit: true` to auto-commit changes

---

## Files to Modify

1. **[src/services/changeset-service.ts](src/services/changeset-service.ts)**
   - Remove `triggerPublishPipeline()` function
   - Update `generateChangeset()` to use `pnpm changeset add`
   - Add error sanitization to all try-catch blocks

2. **[src/controllers/publish-controller.ts](src/controllers/publish-controller.ts)**
   - Remove call to `triggerPublishPipeline()`
   - Return success after changeset creation
   - Remove the `/api/publish/trigger` endpoint

3. **[.github/workflows/release.yml](.github/workflows/release.yml)**
   - Verify automatic trigger on `push: main`
   - Ensure `changesets/action` is properly configured
   - Confirm NPM_TOKEN is only in GitHub Secrets

4. **[.changeset/config.json](.changeset/config.json)**
   - Consider setting `commit: true`
   - Review other configuration options

---

## Questions to Answer

1. Should changesets be auto-committed after creation, or manually committed?
   - Current: Manual via backend
   - Recommended: Auto-commit in CI via `changesets/action`

2. Should GitHub Actions run on every push to main, or only on specific branches?
   - Current: Every push to main (good)
   - Fallback: Manual trigger via `workflow_dispatch` (already configured)

3. Should you maintain a release branch or use trunk-based development?
   - Current: Push directly to main
   - If using release branches, adjust `.changeset/config.json` baseBranch

