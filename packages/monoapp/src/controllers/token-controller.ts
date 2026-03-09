/**
 * Token Management Controller
 * Handles API endpoints for updating and managing GitHub and NPM tokens
 */

import { Request, Response } from 'express';
import { AppLogger } from '../middleware/logger';
import { secureTokenService } from '../services/secure-token-service';
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_OK,
} from '../constants/http';

/**
 * Update GitHub repository secret via GitHub API
 * Requires: GITHUB_TOKEN with repo and secrets permissions
 */
async function updateGitHubSecret(
  secretName: string,
  secretValue: string,
  githubToken: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Get repo info from environment or use defaults
    const repoOwner = process.env.GITHUB_REPO_OWNER || 'manojkmfsi';
    const repoName = process.env.GITHUB_REPO_NAME || 'monodog';

    // Attempt to import sodium for encryption using dynamic import
    let sodium: any = null;
    try {
      // Try to load libsodium-wrappers
      try {
        // @ts-expect-error - Dynamic import for optional dependency
        sodium = await import('libsodium-wrappers').catch(() => null);
        if (sodium && sodium.ready) await sodium.ready;
      } catch (e) {
        // Continue to next attempt
      }

      // Fall back to tweetnacl if libsodium failed
      if (!sodium) {
        try {
          // @ts-expect-error - Dynamic import for optional dependency
          sodium = await import('tweetnacl').catch(() => null);
        } catch (e2) {
          // Both failed, will handle below
        }
      }

      if (!sodium) {
        AppLogger.warn(
          'Encryption library not found. GitHub secret update will be skipped. Install with: npm install libsodium-wrappers'
        );
      }
    } catch (setupError) {
      AppLogger.warn(`Failed to load encryption libraries: ${setupError}`);
    }

    // First, get the public key for the repository
    const getKeyResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/public-key`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          Accept: 'application/vnd.github+json',
          'User-Agent': 'monodog-token-manager',
        },
      }
    );

    if (!getKeyResponse.ok) {
      throw new Error(
        `Failed to get public key (${getKeyResponse.status}): ${getKeyResponse.statusText}`
      );
    }

    const keyData = await getKeyResponse.json();
    const publicKey = keyData.key;
    const keyId = keyData.key_id;

    let encryptedBase64 = '';

    // Try to encrypt the secret if sodium is available
    if (sodium) {
      try {
        const encodedSecret = Buffer.from(secretValue, 'utf-8');
        const decodedKey = Buffer.from(publicKey, 'base64');

        let encryptedSecret: any;
        if (sodium.box?.seal) {
          encryptedSecret = sodium.box.seal(encodedSecret, decodedKey);
        } else if (sodium.crypto_box_seal) {
          encryptedSecret = Buffer.from(
            sodium.crypto_box_seal(encodedSecret, decodedKey)
          );
        }

        if (encryptedSecret) {
          encryptedBase64 = Buffer.from(encryptedSecret).toString('base64');
        }
      } catch (encryptError) {
        AppLogger.warn(`Encryption failed: ${encryptError}`);
        throw encryptError;
      }
    } else {
      throw new Error(
        'Encryption library not available. Install: npm install libsodium-wrappers'
      );
    }

    // Update the secret in the repository
    const updateResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/${secretName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          Accept: 'application/vnd.github+json',
          'User-Agent': 'monodog-token-manager',
        },
        body: JSON.stringify({
          encrypted_value: encryptedBase64,
          key_id: keyId,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(
        `Failed to update secret (${updateResponse.status}): ${errorText}`
      );
    }

    AppLogger.info(
      `GitHub secret "${secretName}" updated successfully in ${repoOwner}/${repoName}`
    );

    return {
      success: true,
      message: `GitHub secret "${secretName}" updated successfully`,
    };
  } catch (error) {
    AppLogger.error(`Failed to update GitHub secret: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update GitHub secret',
    };
  }
}

/**
 * Validate token format
 */
function validateTokenFormat(token: string, type: 'npm' | 'github'): boolean {
  if (!token || typeof token !== 'string') return false;

  token = token.trim();

  if (type === 'npm') {
    // NPM tokens are typically long alphanumeric strings or start with npm_ or have an underscore
    return token.length >= 20;
  } else if (type === 'github') {
    // GitHub tokens (classic) are alphanumeric, PAT tokens start with ghp_ or github_pat_
    return (
      token.length >= 20 &&
      (token.startsWith('ghp_') || token.startsWith('github_pat_') || /^[a-zA-Z0-9]{40,}$/.test(token))
    );
  }

  return false;
}

/**
 * POST /api/tokens/generate-github-token
 * Generate a short-lived GitHub token using existing GITHUB_TOKEN or OAuth flow
 */
export const generateShortLivedGitHubToken = async (req: Request, res: Response) => {
  try {
    const authToken = process.env.GITHUB_TOKEN;

    // If no GITHUB_TOKEN exists, try to generate one using OAuth credentials
    if (!authToken) {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          success: false,
          error: 'GitHub authentication not configured',
          message: 'Please configure either GITHUB_TOKEN or GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET environment variables',
        });
      }

      AppLogger.info('No GITHUB_TOKEN found. Generating short-lived token using OAuth credentials...');

      // Use GitHub's OAuth device flow or app installation endpoint
      // For now, return helpful error message
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        error: 'Initial GitHub token required',
        message: 'Please set an initial GITHUB_TOKEN environment variable. Short-lived tokens can then be generated from it.',
      });
    }

    AppLogger.info('Generating short-lived GitHub token using existing authentication...');

    // Create a personal access token with expiration
    // GitHub API: POST /authorizations or create via PAT endpoint
    const tokenResponse = await fetch('https://api.github.com/authorizations', {
      method: 'POST',
      headers: {
        'Authorization': `token ${authToken}`,
        'User-Agent': 'monodog-token-manager',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        scopes: ['repo', 'workflow'],
        note: `monodog-short-lived-${Date.now()}`,
        note_url: 'https://github.com/manojkmfsi/monodog',
      }),
    });

    // Check for errors
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      
      // The /authorizations endpoint might not be available for newer token types
      // Try alternative approach using personal access tokens
      if (tokenResponse.status === 404 || tokenResponse.status === 422) {
        AppLogger.info('Falling back to alternative token generation method...');

        // Alternative: Use the user API to get a list of authorizations or create via app
        const userResponse = await fetch('https://api.github.com/user', {
          method: 'GET',
          headers: {
            'Authorization': `token ${authToken}`,
            'User-Agent': 'monodog-token-manager',
            'Accept': 'application/vnd.github+json',
          },
        });

        if (!userResponse.ok) {
          throw new Error(
            `Authentication failed (${userResponse.status}): ${userResponse.statusText}. Your GITHUB_TOKEN may be invalid or revoked.`
          );
        }

        const userData = await userResponse.json();
        const login = userData.login;

        AppLogger.warn(
          `Short-lived token generation not available via this method. Returning current token. User: ${login}`
        );

        // Return the current token with a warning about expiration
        return res.status(HTTP_STATUS_OK).json({
          success: true,
          token: authToken,
          expiresAt: null,
          expiresIn: 'Until revoked (long-lived)',
          message:
            'Current GITHUB_TOKEN returned. For proper short-lived tokens, use GitHub CLI: gh auth token --refresh',
          warning:
            'Consider using GitHub CLI for better token management: gh auth token --refresh --scopes repo,workflow',
        });
      }

      throw new Error(
        `Failed to generate token (${tokenResponse.status}): ${errorData.message || errorData.error || tokenResponse.statusText}`
      );
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.token;
    const expiresAt = tokenData.expires_at;

    if (!token) {
      throw new Error('No token returned from GitHub API');
    }

    // Calculate time remaining
    let expiresInText = 'Until revoked';
    if (expiresAt) {
      const expiresAtMs = new Date(expiresAt).getTime();
      const nowMs = Date.now();
      const expiresInSeconds = Math.floor((expiresAtMs - nowMs) / 1000);
      const expiresInMinutes = Math.floor(expiresInSeconds / 60);
      const expiresInHours = Math.floor(expiresInMinutes / 60);

      if (expiresInHours > 0) {
        expiresInText = `${expiresInHours} hour${expiresInHours > 1 ? 's' : ''}`;
      } else if (expiresInMinutes > 0) {
        expiresInText = `${expiresInMinutes} minute${expiresInMinutes > 1 ? 's' : ''}`;
      } else {
        expiresInText = `${expiresInSeconds} second${expiresInSeconds > 1 ? 's' : ''}`;
      }
    }

    AppLogger.info(`✓ Token generated successfully (expires: ${expiresInText})`);

    res.status(HTTP_STATUS_OK).json({
      success: true,
      token,
      expiresAt,
      expiresIn: expiresInText,
      message: `Token generated and will expire ${expiresInText === 'Until revoked' ? 'when revoked' : `in ${expiresInText}`}`,
    });
  } catch (error) {
    AppLogger.error(`Failed to generate short-lived GitHub token: ${error}`);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to generate short-lived GitHub token',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/tokens/update
 * Update GitHub or NPM token
 */
export const updateToken = async (req: Request, res: Response) => {
  try {
    const { tokenType, tokenValue } = req.body;

    // Validate request
    if (!tokenType || !tokenValue) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        error: 'Missing tokenType or tokenValue',
      });
    }

    if (!['npm', 'github'].includes(tokenType)) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        error: 'Invalid tokenType. Must be "npm" or "github"',
      });
    }

    // Validate token format
    if (!validateTokenFormat(tokenValue, tokenType as 'npm' | 'github')) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        error: `Invalid ${tokenType} token format`,
      });
    }

    // Set the token in environment
    const envKey = tokenType === 'npm' ? 'NPM_TOKEN' : 'GITHUB_TOKEN';
    process.env[envKey] = tokenValue.trim();

    AppLogger.info(`✓ ${tokenType.toUpperCase()} token updated successfully in memory`);

    // If updating GitHub token, also update GitHub repository secrets
    let githubSecretResult: { success: boolean; message?: string; error?: string } | null =
      null;

    if (tokenType === 'github') {
      AppLogger.info('Attempting to update GitHub repository secrets...');
      githubSecretResult = await updateGitHubSecret('GITHUB_TOKEN', tokenValue.trim(), tokenValue);

      if (githubSecretResult.success) {
        AppLogger.info('✓ GitHub repository secret updated successfully');
      } else {
        AppLogger.warn(`GitHub secret update warning: ${githubSecretResult.error}`);
      }
    }

    res.status(HTTP_STATUS_OK).json({
      success: true,
      message: `${tokenType} token updated successfully`,
      tokenType,
      details: {
        environmentUpdated: true,
        githubSecretUpdated: githubSecretResult?.success || false,
        githubSecretError: githubSecretResult?.error || undefined,
      },
    });
  } catch (error) {
    AppLogger.error(`Failed to update token: ${error}`);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to update token',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/tokens/status
 * Check if tokens are configured
 */
export const getTokenStatus = async (req: Request, res: Response) => {
  try {
    const npmTokenConfigured = !!process.env.NPM_TOKEN;
    const githubTokenConfigured = !!process.env.GITHUB_TOKEN;

    res.status(HTTP_STATUS_OK).json({
      success: true,
      tokens: {
        npm: {
          configured: npmTokenConfigured,
          source: npmTokenConfigured ? 'environment' : 'not configured',
        },
        github: {
          configured: githubTokenConfigured,
          source: githubTokenConfigured ? 'environment' : 'not configured',
        },
      },
    });
  } catch (error) {
    AppLogger.error(`Failed to get token status: ${error}`);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get token status',
    });
  }
};

/**
 * POST /api/tokens/validate
 * Test if a token is valid (optional - requires external API calls)
 */
export const validateToken = async (req: Request, res: Response) => {
  try {
    const { tokenType, tokenValue } = req.body;

    if (!tokenType || !tokenValue) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        error: 'Missing tokenType or tokenValue',
      });
    }

    // Validate format first
    if (!validateTokenFormat(tokenValue, tokenType as 'npm' | 'github')) {
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        valid: false,
        error: `Invalid ${tokenType} token format`,
      });
    }

    // For now, just confirm format validation
    // In a real scenario, you'd make API calls to npm and GitHub to verify
    res.status(HTTP_STATUS_OK).json({
      success: true,
      valid: true,
      message: `${tokenType} token format is valid. Full validation requires API calls.`,
      tokenType,
    });
  } catch (error) {
    AppLogger.error(`Failed to validate token: ${error}`);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to validate token',
    });
  }
};
