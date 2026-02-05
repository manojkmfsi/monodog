# GitHub OAuth Implementation Guide

## Overview

This document provides a complete guide to the GitHub OAuth authentication system implemented in MonoDog. The system uses GitHub as the single source of truth for authorization, dynamically resolving user permissions based on their repository roles.

## Architecture

### Backend Architecture

```
GitHub OAuth Flow:
1. User clicks "Login with GitHub"
2. Redirect to GitHub auth page
3. User grants permissions
4. GitHub redirects with auth code
5. Backend exchanges code for access token
6. Backend queries GitHub API for user info
7. Create session and return session token

Permission Resolution:
1. User selects/accesses repository
2. Backend queries GitHub API: GET /repos/{owner}/{repo}/collaborators/{username}/permission
3. Map GitHub permission to MonoDog role
4. Cache permission with 5-minute TTL
5. Enforce permission on subsequent requests
```

### Components

#### Backend (packages/monoapp/src)

1. **types/auth.ts**
   - Type definitions for authentication
   - Permission types and interfaces
   - Session and OAuth structures

2. **services/github-oauth-service.ts**
   - GitHub API integration
   - OAuth token exchange
   - User info retrieval
   - Repository permission queries
   - Permission mapping to roles

3. **services/permission-service.ts**
   - Permission caching with TTL
   - Cache lifecycle management
   - Automatic cache cleanup
   - Permission validation logic

4. **middleware/auth-middleware.ts**
   - Session management
   - Session token generation
   - Request authentication
   - Permission verification middleware
   - Session lifecycle (create, validate, refresh, destroy)

5. **routes/auth-routes.ts**
   - `/auth/login` - Initiate OAuth
   - `/auth/callback` - OAuth callback
   - `/auth/me` - Get current user
   - `/auth/validate` - Validate session
   - `/auth/logout` - Logout
   - `/auth/refresh` - Refresh token

6. **routes/permission-routes.ts**
   - `/permissions/:owner/:repo` - Check permission
   - `/permissions/:owner/:repo/can-action` - Check action permission
   - `/permissions/:owner/:repo/invalidate` - Invalidate cache

#### Frontend (packages/monoapp/monodog-dashboard/src)

1. **services/auth-context.tsx**
   - Auth state management
   - Login/logout functionality
   - Session persistence
   - Token refresh logic
   - Provides `useAuth()` hook

2. **services/permission-context.tsx**
   - Permission state management
   - Permission checking
   - Action permission validation
   - Permission caching
   - Provides `usePermission()` hook

3. **pages/LoginPage.tsx**
   - GitHub OAuth login UI
   - Displays required permissions
   - Initiates auth flow

4. **pages/AuthCallbackPage.tsx**
   - OAuth callback handler
   - Processes auth response
   - Establishes session
   - Redirects to app

5. **components/ProtectedRoute.tsx**
   - Route wrapper for authentication
   - Redirects unauthenticated users to login
   - Shows loading state while checking auth

6. **components/PermissionGuard.tsx**
   - Route wrapper for repository permissions
   - Checks user has required permission level
   - Shows access denied if insufficient permissions
   - Enforces per-repository access control

7. **styles/auth.css**
   - Login page styling
   - Callback page styling
   - Error and loading states

## Data Flow

### Login Flow

```
User clicks Login
    ↓
Frontend calls GET /api/auth/login
    ↓
Backend generates OAuth authorization URL
    ↓
Frontend redirects to GitHub OAuth
    ↓
User grants permissions on GitHub
    ↓
GitHub redirects to /auth/callback with code & state
    ↓
Frontend calls GET /api/auth/callback?code=...&state=...
    ↓
Backend validates state (CSRF protection)
    ↓
Backend exchanges code for access token
    ↓
Backend queries GitHub API for user info
    ↓
Backend creates session
    ↓
Frontend stores session token in localStorage
    ↓
Frontend redirects to dashboard
```

### Permission Check Flow

```
User accesses protected resource
    ↓
PermissionGuard component checks permission
    ↓
Frontend calls GET /api/permissions/:owner/:repo
    ↓
Backend checks permission cache
    ↓
If cached and valid:
    Return cached permission
Else:
    Query GitHub API
    Cache result with 5-minute TTL
    Return permission
    ↓
Frontend compares with required permission
    ↓
If sufficient: Show resource
If denied: Show access denied message
```

### Permission Hierarchy

```
GitHub Permission → MonoDog Role → Can Perform
────────────────────────────────────────────
admin              Admin          [read, write, maintain, admin]
maintain           Maintainer     [read, write, maintain]
write              Collaborator   [read, write]
read               Collaborator   [read]
none               Denied         []
```

## Usage Examples

### Backend Usage

**Check if user has permission:**
```typescript
import { getUserRepositoryPermission, canPerformAction } from '../services/permission-service';

const permission = await getUserRepositoryPermission(
  accessToken,
  userId,
  username,
  'owner',
  'repo'
);

const canWrite = canPerformAction(permission.permission, 'write');
```

**Create protected endpoint:**
```typescript
router.post(
  '/api/packages/publish',
  authenticationMiddleware,
  repositoryPermissionMiddleware('write'),
  async (req: Request, res: Response) => {
    // Only users with 'write' or higher permission reach here
  }
);
```

### Frontend Usage

**Get current user:**
```typescript
import { useAuth } from '../services/auth-context';

function MyComponent() {
  const { session, login, logout } = useAuth();

  if (!session) {
    return <button onClick={login}>Login</button>;
  }

  return (
    <>
      <p>Welcome, {session.user.login}!</p>
      <button onClick={logout}>Logout</button>
    </>
  );
}
```

**Check permission:**
```typescript
import { usePermission } from '../services/permission-context';
import { useAuth } from '../services/auth-context';

function PackagePublisher() {
  const { session } = useAuth();
  const { checkPermission, canPerformAction } = usePermission();

  const handlePublish = async () => {
    if (!session) return;

    const canPublish = await canPerformAction(
      session.sessionToken,
      'owner',
      'repo',
      'write'
    );

    if (canPublish) {
      // Publish package
    } else {
      // Show error
    }
  };

  return <button onClick={handlePublish}>Publish</button>;
}
```

**Use PermissionGuard:**
```typescript
import { PermissionGuard } from '../components/PermissionGuard';

function AdminPanel() {
  return (
    <PermissionGuard owner="owner" repo="repo" requiredPermission="admin">
      <div>Admin controls</div>
    </PermissionGuard>
  );
}
```

## Configuration

### Environment Variables

**Backend (.env):**
```bash
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

**Frontend (.env.local):**
```bash
VITE_API_URL=http://localhost:5000/api
```

### GitHub OAuth App Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set redirect URI to `http://localhost:3000/auth/callback`
4. Copy Client ID and Client Secret
5. Add to backend .env

## Security Features

1. **CSRF Protection**
   - OAuth state tokens with 10-minute expiry
   - State validation on callback

2. **Session Security**
   - Session tokens with 24-hour TTL
   - Server-side session validation
   - Automatic session cleanup

3. **Permission Validation**
   - Server-side permission checks
   - Cache with short TTL (5 minutes)
   - Revalidation on token refresh

4. **Token Management**
   - Access tokens never exposed to frontend (passed via Authorization header)
   - Session tokens used for API calls
   - Token expiry enforcement

5. **Rate Limiting**
   - GitHub API rate limit handling
   - Permission caching reduces API calls
   - Consider implementing API rate limiting

## Caching Strategy

### Permission Cache

- **Key:** `{userId}:{owner}/{repo}`
- **TTL:** 5 minutes (configurable)
- **Size:** Max 10,000 entries
- **Eviction:** Oldest entry removed when cache full
- **Cleanup:** Every 1 minute

### Benefits
- Reduces GitHub API calls
- Faster permission checks
- Lower latency for users
- Respects GitHub rate limits

### Considerations
- Permissions may be stale for 5 minutes
- Can be manually invalidated
- Automatic cleanup prevents memory leaks

## Error Handling

### User-Facing Errors

- **401 Unauthorized:** No valid session, redirect to login
- **403 Forbidden:** User lacks required permissions
- **500 Server Error:** Unexpected error, show error message

### API Errors

- **GitHub OAuth Errors:** Logged and returned to user
- **GitHub API Errors:** Logged, permission defaults to 'none'
- **Session Errors:** Logged, session invalidated
- **Rate Limiting:** Handled gracefully with cache

## Monitoring & Debugging

### Session Statistics
```typescript
import { getSessionStats } from '../middleware/auth-middleware';

const stats = getSessionStats();
console.log(`Active sessions: ${stats.activeSessions}`);
```

### Cache Statistics
```typescript
import { getCacheStats } from '../services/permission-service';

const stats = getCacheStats();
console.log(`Cache utilization: ${stats.utilizationPercent}%`);
```

### Logging
All auth operations are logged with appropriate levels:
- `debug`: Token generation, cache hits
- `info`: User authentication, session creation
- `warn`: Failed validations, expired sessions
- `error`: Critical failures

## Testing

### Manual Testing Checklist

- [ ] Login with GitHub
- [ ] OAuth callback handled correctly
- [ ] Session created and stored
- [ ] Get user info endpoint works
- [ ] Validate session endpoint works
- [ ] Check repository permissions
- [ ] Logout clears session
- [ ] Expired sessions handled
- [ ] Refresh token works
- [ ] PermissionGuard shows access denied
- [ ] Permission cache works
- [ ] Cache invalidation works

### Integration Testing

```typescript
// Example test
describe('GitHub OAuth', () => {
  test('should authenticate user and create session', async () => {
    const code = 'test_code';
    const response = await request(app)
      .get('/api/auth/callback')
      .query({ code, state: 'test_state' });

    expect(response.status).toBe(200);
    expect(response.body.sessionToken).toBeDefined();
    expect(response.body.user).toBeDefined();
  });
});
```

## Production Deployment

### Critical Changes Needed

1. **Session Storage**
   - Replace in-memory sessions with Redis/PostgreSQL
   - Implement session serialization

2. **Secure Cookies**
   - Store session tokens in HTTP-only cookies
   - Enable Secure flag for HTTPS
   - Set SameSite=Strict

3. **HTTPS Only**
   - All OAuth callbacks must use HTTPS
   - API requests over HTTPS
   - Update OAUTH_REDIRECT_URI to HTTPS

4. **Secrets Management**
   - Use environment variables
   - Use secrets manager (AWS Secrets Manager, etc.)
   - Never commit secrets

5. **Rate Limiting**
   - Implement API rate limiting
   - Handle GitHub API rate limits
   - Implement exponential backoff

6. **Monitoring**
   - Log all authentication events
   - Monitor failed login attempts
   - Track permission cache performance
   - Alert on unusual activity

### Deployment Checklist

- [ ] GitHub OAuth app configured for production domain
- [ ] OAUTH_REDIRECT_URI set to production HTTPS URL
- [ ] All secrets in environment variables
- [ ] Session store (Redis/DB) configured
- [ ] HTTPS enabled for all endpoints
- [ ] Rate limiting configured
- [ ] Monitoring and logging setup
- [ ] Backup/recovery procedures tested

## Troubleshooting

### Common Issues

**"OAuth not configured"**
- Check GITHUB_CLIENT_ID is set
- Verify GitHub OAuth app exists
- Check environment variables loaded

**"Invalid state" in OAuth**
- State token expired (10-minute TTL)
- Try logging in again
- Check server time is accurate

**"User has no permission"**
- User not a collaborator in GitHub repo
- Add user to repo in GitHub
- Wait a few minutes for cache to expire
- Or manually invalidate cache

**Session expires immediately**
- Check TOKEN_EXPIRY configuration
- Verify server time is correct
- Check localStorage (frontend)
- Check session store (backend)

**GitHub API rate limit exceeded**
- Cached permissions reduce API calls
- Implement backoff strategy
- Consider caching at higher level
- Monitor API usage

## Files Created/Modified

### Backend
- `src/types/auth.ts` - NEW
- `src/services/github-oauth-service.ts` - NEW
- `src/services/permission-service.ts` - NEW
- `src/middleware/auth-middleware.ts` - NEW
- `src/routes/auth-routes.ts` - NEW
- `src/routes/permission-routes.ts` - NEW
- `src/middleware/server-startup.ts` - MODIFIED (added auth routes)

### Frontend
- `src/services/auth-context.tsx` - NEW
- `src/services/permission-context.tsx` - NEW
- `src/pages/LoginPage.tsx` - NEW
- `src/pages/AuthCallbackPage.tsx` - NEW
- `src/components/ProtectedRoute.tsx` - NEW
- `src/components/PermissionGuard.tsx` - NEW
- `src/styles/auth.css` - NEW
- `src/components/App.tsx` - MODIFIED (wrapped with auth providers)

### Configuration
- `.env.example` - NEW
- `.env.local.example` - NEW
- `GITHUB_OAUTH_SETUP.md` - NEW
- `IMPLEMENTATION_GUIDE.md` - NEW (this file)

## Support & Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub REST API Collaborators](https://docs.github.com/en/rest/collaborators/collaborators)
- [GitHub Permissions Reference](https://docs.github.com/en/organizations/managing-access-to-your-organizations-repositories/repository-roles-for-an-organization)

## Future Enhancements

1. **Multi-Repository Permission Handling**
   - Show all accessible repositories
   - Allow quick switching between repos
   - Per-repo permission display

2. **Granular Action Permissions**
   - Map specific actions to permission levels
   - Show/hide UI based on permissions
   - Disable actions for lower permissions

3. **Team Support**
   - Support GitHub Teams
   - Inherit team permissions
   - Team-based access control

4. **Audit Logging**
   - Log permission checks
   - Track permission changes
   - Audit trail for compliance

5. **Rate Limit Management**
   - Implement progressive cache TTL
   - Smart cache invalidation
   - Rate limit monitoring
