# GitHub OAuth Implementation - Testing Guide

This guide helps you thoroughly test the GitHub OAuth implementation in MonoDog.

## Prerequisites for Testing

1. Running MonoDog backend on `http://localhost:5000`
2. Running MonoDog frontend on `http://localhost:3000`
3. GitHub OAuth app configured with callback URL `http://localhost:3000/auth/callback`
4. GitHub user account to test with

## Manual Testing Checklist

### Phase 1: Authentication Flow

#### Test 1.1: Login Initiation
- [ ] Navigate to `http://localhost:3000`
- [ ] Should see MonoDog login page
- [ ] Click "Continue with GitHub" button
- [ ] Should redirect to GitHub's OAuth authorization page
- [ ] GitHub page shows MonoDog app and requested permissions
- [ ] Can see requested scopes: `read:user`, `user:email`, `repo`

#### Test 1.2: GitHub Authorization
- [ ] On GitHub OAuth page, click "Authorize"
- [ ] Should see loading spinner on callback page
- [ ] Should redirect to dashboard after 2-3 seconds
- [ ] Should NOT see login page anymore

#### Test 1.3: Session Creation
- [ ] Check browser DevTools → Application → LocalStorage
- [ ] Should see `monodog_session_token` key
- [ ] Should see `monodog_session_data` key with user info
- [ ] Session data contains correct username

#### Test 1.4: User Info Display
- [ ] After login, check if user info is displayed in header/navbar
- [ ] Should show GitHub username/avatar if displayed
- [ ] Check `/api/auth/me` endpoint returns correct user data

### Phase 2: Session Management

#### Test 2.1: Session Validation
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/auth/me
```
- [ ] Returns 200 status
- [ ] Response includes `user` object with correct username
- [ ] Response includes `scopes` array
- [ ] Response includes `expiresAt` timestamp

#### Test 2.2: Session Validation via POST
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/auth/validate
```
- [ ] Returns 200 status
- [ ] Response shows `valid: true`
- [ ] Response includes `expiresAt` timestamp

#### Test 2.3: Session Refresh
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/auth/refresh
```
- [ ] Returns 200 status
- [ ] Returns new `sessionToken`
- [ ] Response includes new `expiresAt` (should be ~24 hours from now)

#### Test 2.4: Invalid Token Handling
```bash
curl -H "Authorization: Bearer INVALID_TOKEN" \
  http://localhost:5000/api/auth/me
```
- [ ] Returns 401 status
- [ ] Returns error message about invalid session

#### Test 2.5: Missing Token Handling
```bash
curl http://localhost:5000/api/auth/me
```
- [ ] Returns 401 status
- [ ] Returns error about missing token

### Phase 3: Permission Resolution

#### Test 3.1: Check Permission for Accessible Repository
Get a repository you have write access to:
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/permissions/github-owner/github-repo
```
- [ ] Returns 200 status
- [ ] Response includes your permission level (admin, maintain, write, or read)
- [ ] Response includes corresponding MonoDog role
- [ ] `canRead`, `canWrite`, etc. flags are correct
- [ ] `denied` is false

#### Test 3.2: Check Permission for Inaccessible Repository
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/permissions/unknown-owner/unknown-repo
```
- [ ] Returns 200 status
- [ ] Response shows `permission: "none"`
- [ ] Response shows `role: "Denied"`
- [ ] `denied` is true
- [ ] All `canRead`, `canWrite`, etc. are false

#### Test 3.3: Action Permission Check
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "write"}' \
  http://localhost:5000/api/permissions/owner/repo/can-action
```
- [ ] Returns 200 status for accessible repos
- [ ] Returns `can: true/false` based on permission level
- [ ] Test with different actions: read, write, maintain, admin

#### Test 3.4: Permission Caching
Repeat test 3.1 twice quickly:
- [ ] First call takes ~100-500ms (GitHub API call)
- [ ] Second call takes <10ms (from cache)
- [ ] Both return identical results

#### Test 3.5: Cache Invalidation
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/permissions/owner/repo/invalidate
```
- [ ] Returns 200 status
- [ ] Next permission check makes fresh GitHub API call
- [ ] Response includes confirmation message

### Phase 4: Frontend Authentication

#### Test 4.1: Protected Routes
- [ ] Clear localStorage (or use private/incognito window)
- [ ] Navigate to `http://localhost:3000/dashboard`
- [ ] Should redirect to login page
- [ ] Login and verify dashboard loads
- [ ] Navigate to other protected routes (packages, health, etc.)
- [ ] All should load successfully after login

#### Test 4.2: Permission Guard Component
Once logged in:
- [ ] Check if UI respects permission levels
- [ ] Admin-only features available if user is admin
- [ ] Write features disabled if user is read-only
- [ ] Actions respect permission levels

#### Test 4.3: Login Page Elements
- [ ] GitHub button is clickable
- [ ] GitHub button shows loading state when clicked
- [ ] Permission descriptions are visible
- [ ] Security information is displayed
- [ ] Page is responsive on mobile

#### Test 4.4: Callback Page
- [ ] During OAuth callback, see loading spinner
- [ ] Page displays "Completing Authentication..."
- [ ] After successful auth, redirects to dashboard
- [ ] Error page shows if callback fails

### Phase 5: Logout

#### Test 5.1: Logout via API
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/auth/logout
```
- [ ] Returns 200 status
- [ ] Returns success message

#### Test 5.2: Logout via Frontend
- [ ] After logout, session token removed from localStorage
- [ ] `monodog_session_token` key deleted
- [ ] `monodog_session_data` key deleted
- [ ] Redirected to login page
- [ ] Cannot access protected routes without re-login

#### Test 5.3: Session Invalid After Logout
After logout, try to access API:
```bash
curl -H "Authorization: Bearer OLD_SESSION_TOKEN" \
  http://localhost:5000/api/auth/me
```
- [ ] Returns 401 status (session was destroyed)

### Phase 6: Permission Hierarchy

#### Test 6.1: Different Permission Levels
Create test users with different GitHub roles:
- [ ] Admin user: can read, write, maintain, admin
- [ ] Maintainer: can read, write, maintain
- [ ] Collaborator (write): can read, write
- [ ] Collaborator (read): can only read
- [ ] No access: cannot do anything

Test each with:
```bash
curl -X POST \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "admin"}' \
  http://localhost:5000/api/permissions/owner/repo/can-action
```

#### Test 6.2: Permission Escalation
Try to access admin action with write permission:
- [ ] Should return `can: false`
- [ ] Frontend should not show admin option
- [ ] API should reject admin action (if called)

### Phase 7: Error Handling

#### Test 7.1: Invalid OAuth Code
```bash
# Manually call callback with invalid code
curl "http://localhost:5000/api/auth/callback?code=invalid_code&state=test_state"
```
- [ ] Returns error response
- [ ] Error message is clear

#### Test 7.2: CSRF Protection (Invalid State)
```bash
# Try with mismatched state
curl "http://localhost:5000/api/auth/callback?code=valid_code&state=wrong_state"
```
- [ ] Returns error about invalid state
- [ ] Callback is rejected

#### Test 7.3: Missing Parameters
```bash
curl "http://localhost:5000/api/auth/callback"
```
- [ ] Returns error about missing code/state
- [ ] Callback is rejected

#### Test 7.4: Network Error Handling
- [ ] Stop backend server
- [ ] Try to login or access protected API
- [ ] Frontend shows appropriate error message
- [ ] Start backend again, can still login

### Phase 8: Performance & Caching

#### Test 8.1: Cache Hit Rate
Make 10 permission checks for same repository:
- [ ] First call: ~200-500ms
- [ ] Calls 2-10: <10ms each
- [ ] All return same results

#### Test 8.2: Cache Expiry
Wait 5 minutes after checking permission:
- [ ] Check permission again
- [ ] Should make new GitHub API call (slower)
- [ ] Old cache entry was removed

#### Test 8.3: Cache Statistics
Check logs for cache statistics:
- [ ] Can see cache size
- [ ] Can see hit/miss rates
- [ ] Expired entries are cleaned up

### Phase 9: Security Tests

#### Test 9.1: No Password Storage
- [ ] Check database for passwords: none stored
- [ ] Check backend code: no password handling
- [ ] GitHub OAuth token never in localStorage

#### Test 9.2: HTTPS in Production
- [ ] Ensure OAUTH_REDIRECT_URI uses https in production
- [ ] Cookies should have Secure flag
- [ ] All API calls should use HTTPS

#### Test 9.3: Token Expiration
- [ ] Set shorter TTL (e.g., 1 minute) for testing
- [ ] Login
- [ ] Wait for expiration
- [ ] Session should be invalid
- [ ] Must re-login

#### Test 9.4: Session Cleanup
- [ ] Create multiple sessions
- [ ] Check in-memory session store size
- [ ] After TTL, sessions should be cleaned
- [ ] Memory doesn't grow unbounded

### Phase 10: Cross-Browser Testing

Test login flow in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

For each:
- [ ] OAuth flow completes
- [ ] Session stored correctly
- [ ] localStorage works
- [ ] No console errors

## Automated Testing (Proposed)

Create test suite:

```typescript
describe('GitHub OAuth', () => {
  test('should exchange code for token', async () => {
    const result = await exchangeCodeForToken('code', 'clientId', 'clientSecret', 'uri');
    expect(result.access_token).toBeDefined();
  });

  test('should get authenticated user', async () => {
    const user = await getAuthenticatedUser('token');
    expect(user.login).toBeDefined();
    expect(user.id).toBeDefined();
  });

  test('should get user permission for repo', async () => {
    const permission = await getRepositoryPermission('token', 'owner', 'repo', 'username');
    expect(['admin', 'maintain', 'write', 'read', 'none']).toContain(permission.permission);
  });

  test('should cache permissions', async () => {
    const start = Date.now();
    await getUserRepositoryPermission(...);
    const time1 = Date.now() - start;

    const start2 = Date.now();
    await getUserRepositoryPermission(...); // Same params
    const time2 = Date.now() - start2;

    expect(time2).toBeLessThan(time1 / 10); // Cache should be 10x faster
  });

  test('should invalidate cache', async () => {
    invalidatePermissionCache(userId, 'owner', 'repo');
    const cached = getCachedPermission(userId, 'owner', 'repo');
    expect(cached).toBeNull();
  });
});
```

## Testing Checklist Summary

- [ ] Phase 1: Authentication Flow (4 tests)
- [ ] Phase 2: Session Management (5 tests)
- [ ] Phase 3: Permission Resolution (5 tests)
- [ ] Phase 4: Frontend Authentication (4 tests)
- [ ] Phase 5: Logout (3 tests)
- [ ] Phase 6: Permission Hierarchy (2 tests)
- [ ] Phase 7: Error Handling (4 tests)
- [ ] Phase 8: Performance & Caching (3 tests)
- [ ] Phase 9: Security Tests (4 tests)
- [ ] Phase 10: Cross-Browser Testing (4 tests)

**Total: 38 manual tests**

## Issues Found During Testing

Document any issues found:

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| ... | ... | ... | ... |

## Sign-Off

- [ ] All tests passed
- [ ] No critical issues
- [ ] No security vulnerabilities
- [ ] Performance acceptable
- [ ] User experience satisfactory
- [ ] Ready for production

---

**Date Tested:** ___________
**Tested By:** ___________
**Notes:** ___________
