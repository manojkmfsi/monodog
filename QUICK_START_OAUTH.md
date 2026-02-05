# GitHub OAuth Quick Start Guide

Get MonoDog running with GitHub OAuth authentication in 5 minutes!

## Prerequisites

- Node.js 16+
- GitHub account
- GitHub OAuth Application (see setup below)

## Step 1: Create GitHub OAuth Application

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name:** MonoDog
   - **Homepage URL:** http://localhost:3000
   - **Authorization callback URL:** http://localhost:3000/auth/callback
4. Copy your **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

### Backend Configuration

Create `packages/monoapp/.env`:

```bash
GITHUB_CLIENT_ID=your_client_id_from_github
GITHUB_CLIENT_SECRET=your_client_secret_from_github
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

### Frontend Configuration

Create `packages/monoapp/monodog-dashboard/.env.local`:

```bash
VITE_API_URL=http://localhost:5000/api
```

## Step 3: Install Dependencies

```bash
# From project root
pnpm install

# Or if using npm
npm install
```

## Step 4: Start the Application

### Terminal 1 - Start Backend

```bash
cd packages/monoapp
pnpm dev
```

Backend will run on `http://localhost:5000`

### Terminal 2 - Start Frontend

```bash
cd packages/monoapp/monodog-dashboard
pnpm dev
```

Frontend will run on `http://localhost:3000` (or next available port)

## Step 5: Test the Flow

1. Open http://localhost:3000 in your browser
2. You should see the MonoDog login page
3. Click "Continue with GitHub"
4. Authorize the application on GitHub
5. You'll be redirected back to MonoDog
6. You're now logged in!

## What Happens Behind the Scenes

```
You Click Login
    ↓
GitHub OAuth Authorization
    ↓
Backend gets access token from GitHub
    ↓
Backend queries your GitHub profile
    ↓
Backend creates session
    ↓
You're logged into MonoDog
    ↓
Access repository features with GitHub permissions
```

## Key Features

✅ **No Password Management** - GitHub handles authentication
✅ **Dynamic Permissions** - Your role in each repo determines access
✅ **Automatic Sync** - Permissions update from GitHub in real-time
✅ **Secure Sessions** - Sessions timeout after 24 hours
✅ **Smart Caching** - Permissions cached for 5 minutes to reduce API calls

## Default Permissions

The OAuth flow requests these GitHub permissions:

- `read:user` - Read your profile
- `user:email` - Access your email
- `repo` - Access your repositories (needed for private repos)

## How Permissions Work

Your access level in MonoDog matches your GitHub role:

| GitHub Permission | MonoDog Role | Can Do |
|---|---|---|
| admin | Admin | Everything |
| maintain | Maintainer | Write + maintain |
| write | Collaborator | Read + write |
| read | Collaborator | Read only |
| none | Denied | Nothing |

## Testing Permissions

After logging in, your permissions are automatically resolved for each repository:

1. Login to MonoDog
2. Select a repository you have access to
3. Your permissions are automatically loaded from GitHub
4. Your access level controls what you can do

## Troubleshooting

### "OAuth not configured" Error

**Solution:** Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set in `.env`

### "Invalid redirect URI" Error on GitHub

**Solution:** Make sure the callback URL in GitHub OAuth app settings exactly matches `OAUTH_REDIRECT_URI` in your `.env`

### Login redirects to GitHub but doesn't come back

**Solution:**
1. Check `OAUTH_REDIRECT_URI` matches GitHub app settings
2. Make sure backend is running on port 5000
3. Check browser console for errors

### "User has no permission" message

**Solution:**
1. The user doesn't have access to that repository
2. Add the user as a collaborator in the GitHub repository
3. Wait a few minutes for permissions to refresh

### Sessions keep expiring

**Solution:**
- Default session timeout is 24 hours
- Login again if your session expires
- Session is automatically refreshed when you use the app

## Next Steps

After you have MonoDog running:

1. Add team members by adding them as collaborators in your GitHub repositories
2. Start using the dashboard
3. Check out the [full documentation](./GITHUB_OAUTH_SETUP.md)
4. For production deployment, see [Implementation Guide](./IMPLEMENTATION_GUIDE.md)

## File Structure

```
monodog/
├── packages/monoapp/
│   ├── .env                    # Backend env variables
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth-routes.ts
│   │   │   └── permission-routes.ts
│   │   └── services/
│   │       ├── github-oauth-service.ts
│   │       └── permission-service.ts
│   │
│   └── monodog-dashboard/
│       ├── .env.local          # Frontend env variables
│       └── src/
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   └── AuthCallbackPage.tsx
│           └── services/
│               ├── auth-context.tsx
│               └── permission-context.tsx
```

## Common Tasks

### Check Current User

```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/auth/me
```

### Check Your Permission for a Repository

```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/permissions/owner/repo-name
```

### Logout

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:5000/api/auth/logout
```

## Useful Links

- 🔐 [GitHub OAuth Docs](https://docs.github.com/en/developers/apps/building-oauth-apps)
- 📚 [Full Setup Guide](./GITHUB_OAUTH_SETUP.md)
- 🏗️ [Implementation Details](./IMPLEMENTATION_GUIDE.md)
- 🐙 [GitHub Collaborators API](https://docs.github.com/en/rest/collaborators/collaborators)

## Questions?

Refer to the [full documentation](./IMPLEMENTATION_GUIDE.md) or check the [setup guide](./GITHUB_OAUTH_SETUP.md).

Happy coding! 🚀
