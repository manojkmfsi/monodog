#!/usr/bin/env node

/**
 * This script creates a test session by directly calling the auth middleware's storeSession function
 * It simulates what happens after a successful GitHub OAuth login
 */

const { storeSession } = require('./dist/middleware/auth-middleware');

// Create a mock session
const mockSession = {
  accessToken: 'gho_test_token_' + Math.random().toString(36).substr(2, 9),
  expiresIn: 3600,
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  user: {
    id: 12345,
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    public_repos: 5,
    followers: 10,
    following: 5,
  },
  scopes: ['repo', 'read:user'],
  permission: {
    permission: 'maintain',
    role: 'Maintainer',
    userId: 12345,
    username: 'testuser',
    owner: 'manojkmfsi',
    repo: 'MonoDog',
    cachedAt: Date.now(),
    ttl: 3600000,
  },
};

try {
  const token = storeSession(mockSession);
  console.log('✅ Test session created successfully!');
  console.log(`\nSession Token: ${token}`);
  console.log(`User: ${mockSession.user.login}`);
  console.log(`Permission: ${mockSession.permission.permission}`);
  console.log(`Expires at: ${new Date(mockSession.expiresAt).toISOString()}`);
  console.log(`\nYou can use this token in API requests:`);
  console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:8999/api/publish/trigger`);
} catch (error) {
  console.error('❌ Failed to create session:', error.message);
  process.exit(1);
}
