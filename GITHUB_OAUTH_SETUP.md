# GitHub OAuth Configuration Guide

This document explains how to set up GitHub OAuth for MonoDog authentication.

## Backend Setup

### Environment Variables

Create a `.env` file in the `packages/monoapp` directory with the following variables:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

# Database URL
DATABASE_URL=postgresql://user:password@localhost:5432/monodog

# Server Configuration
SERVER_HOST=localhost
SERVER_PORT=5000
DASHBOARD_HOST=localhost
DASHBOARD_PORT=3000

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Creating GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in the application details:
   - **Application name:** MonoDog
   - **Homepage URL:** http://localhost:3000
   - **Authorization callback URL:** http://localhost:3000/auth/callback

4. Copy the **Client ID** and **Client Secret**
5. Add these to your `.env` file

## Frontend Setup

### Environment Variables

Create a `.env.local` file in the `packages/monoapp/monodog-dashboard` directory:

```bash
# API Configuration
VITE_API_URL=http://localhost:5000/api
```

## Features Implemented

### Authentication Flow

1. **GitHub OAuth Login**
   - Users click "Continue with GitHub" button
   - Redirected to GitHub authorization page
   - User grants required permissions
   - GitHub redirects back with authorization code
   - MonoDog exchanges code for access token
   - Session created and stored

2. **Session Management**
   - Sessions stored in memory with TTL
   - Sessions auto-refresh before expiry
   - Logout invalidates session
   - Expired sessions auto-cleaned

### Permission Resolution

1. **GitHub API Integration**
   - Queries `GET /repos/{owner}/{repo}/collaborators/{username}/permission`
   - Maps GitHub permissions to MonoDog roles:
     - `admin` → Admin
     - `maintain` → Maintainer
     - `write` or `read` → Collaborator
     - `none` → Denied

2. **Permission Caching**
   - Permissions cached with 5-minute TTL
   - Automatic cache cleanup
   - Manual cache invalidation available
   - Cache size limited to 10,000 entries

3. **Server-Side Authorization**
   - All permission checks happen on backend
   - Frontend respects server decisions
   - Permission validation on each request

## API Endpoints

### Authentication Routes (`/api/auth`)

- `GET /login` - Initiate GitHub OAuth flow
- `GET /callback?code=...&state=...` - OAuth callback handler
- `GET /me` - Get current user info (requires auth)
- `POST /validate` - Validate session token (requires auth)
- `POST /logout` - Logout user (requires auth)
- `POST /refresh` - Refresh session token (requires auth)

### Permission Routes (`/api/permissions`)

- `GET /:owner/:repo` - Check user permission for repository
- `POST /:owner/:repo/can-action` - Check if user can perform action
- `POST /:owner/:repo/invalidate` - Invalidate cached permission

### Example Requests

**Initiate Login:**
```bash
curl http://localhost:5000/api/auth/login
```

**Get Current User:**
```bash
curl -H "Authorization: Bearer SESSION_TOKEN" \
  http://localhost:5000/api/auth/me
```

**Check Repository Permission:**
```bash
curl -H "Authorization: Bearer SESSION_TOKEN" \
  http://localhost:5000/api/permissions/owner/repo-name
```

**Check Action Permission:**
```bash
curl -X POST \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "write"}' \
  http://localhost:5000/api/permissions/owner/repo-name/can-action
```

## Required GitHub Scopes

The OAuth flow requests these scopes:

- `read:user` - Read user profile information
- `user:email` - Access user email
- `repo` - Full access to repositories (including private ones)

## Security Considerations

1. **Token Storage**
   - Backend: Session tokens stored in memory with TTL
   - Frontend: Session tokens stored in localStorage
   - Consider using secure HTTP-only cookies in production

2. **CSRF Protection**
   - OAuth state tokens generated and validated
   - State expires after 10 minutes

3. **Permission Caching**
   - Cached with short TTL (5 minutes)
   - Can be manually invalidated
   - Revalidated on session refresh

4. **Rate Limiting**
   - GitHub API has rate limits
   - Permission caching reduces API calls
   - Consider implementing rate limit handling

## Production Deployment

For production deployment:

1. **Use Secure Session Storage**
   - Replace in-memory sessions with Redis/database
   - Implement proper session serialization

2. **HTTPS Only**
   - Set `OAUTH_REDIRECT_URI` to HTTPS URL
   - Use secure cookies

3. **Environment Configuration**
   - Use environment variables for all secrets
   - Never commit `.env` files
   - Use secrets management system

4. **Monitoring**
   - Log authentication events
   - Monitor token validation failures
   - Track permission cache hit rates

5. **Rate Limiting**
   - Implement API rate limiting
   - Cache GitHub API responses appropriately
   - Handle rate limit gracefully

## Troubleshooting

### "OAuth not configured" Error
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
- Verify OAuth app exists in GitHub settings

### "Invalid state" Error
- CSRF validation failed
- State token may have expired (10-minute TTL)
- Try logging in again

### "User has no permission" Error
- User doesn't have access to the repository
- Add user as collaborator in GitHub repository
- Check repository permission level matches required action

### Session Expires Quickly
- Default session TTL is 24 hours
- Modify `sessionTimeout` in `auth-middleware.ts` if needed
- Frontend auto-refreshes before expiry

## File Structure

```
packages/monoapp/
├── src/
│   ├── types/
│   │   └── auth.ts                 # Auth type definitions
│   ├── services/
│   │   ├── github-oauth-service.ts # GitHub API integration
│   │   └── permission-service.ts   # Permission caching/validation
│   ├── middleware/
│   │   └── auth-middleware.ts      # Auth middleware & session mgmt
│   └── routes/
│       ├── auth-routes.ts          # Auth endpoints
│       └── permission-routes.ts    # Permission endpoints
│
└── monodog-dashboard/src/
    ├── services/
    │   ├── auth-context.tsx        # Auth context provider
    │   └── permission-context.tsx  # Permission context provider
    ├── components/
    │   ├── ProtectedRoute.tsx       # Protected route wrapper
    │   ├── PermissionGuard.tsx      # Permission guard component
    │   └── App.tsx                 # Updated with auth providers
    ├── pages/
    │   ├── LoginPage.tsx           # GitHub OAuth login page
    │   └── AuthCallbackPage.tsx    # OAuth callback handler
    └── styles/
        └── auth.css                # Auth styles
```

## Next Steps

1. Configure GitHub OAuth application
2. Set environment variables
3. Start backend and frontend servers
4. Test authentication flow
5. Test permission resolution
6. Implement permission guards in UI components
7. Add logging and monitoring

## Support

For issues or questions about the implementation, refer to:
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub Collaborator Permissions API](https://docs.github.com/en/rest/collaborators/collaborators)
