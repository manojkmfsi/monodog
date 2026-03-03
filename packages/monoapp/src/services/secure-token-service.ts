/**
 * Secure Token Service
 * Handles secure storage and retrieval of authentication tokens
 * Never logs or exposes token values
 */

import crypto from 'crypto';

interface TokenStore {
  type: 'npm' | 'github' | 'git';
  source: 'env' | 'user_secret' | 'oauth';
  expiresAt?: Date;
  scopes?: string[];
}

interface UserSecret {
  secretName: string;
  secretType: 'npm_token' | 'github_token' | 'github_oauth';
  encryptedValue: string;
  encryptionVersion: number;
  addedAt: Date;
  expiresAt?: Date;
}

/**
 * Sanitize sensitive strings for safe logging
 */
function sanitize(str: string): string {
  if (!str) return '';
  if (str.length < 10) return '***';
  return `${str.slice(0, 4)}***${str.slice(-4)}`;
}

export class SecureTokenService {
  private encryptionVersion = 1;
  private readonly encryptionAlgorithm = 'aes-256-gcm';

  /**
   * Load token from environment variables (never logs value)
   */
  async loadEnvToken(key: string): Promise<string> {
    const token = process.env[key];
    if (!token) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    console.debug(`✓ Loaded token from environment: ${key}`);
    return token;
  }

  /**
   * Load token from user secrets (encrypted in database)
   * Note: In real implementation, this would fetch from database
   */
  async loadUserSecret(userId: string, secretName: string): Promise<string> {
    // TODO: Implement with actual database access
    // const secret = await userSecretRepository.get(userId, secretName);
    // return this.decrypt(secret.encryptedValue, this.deriveMasterKey(userId));
    throw new Error(`User secrets not yet implemented. Add token via ${secretName}`);
  }

  /**
   * Load token from OAuth session (already secured by session middleware)
   */
  async loadOAuthToken(userId: string): Promise<string> {
    // TODO: Implement with actual session storage
    // const session = await sessionRepository.get(userId);
    // if (!session?.accessToken) throw new Error('No OAuth session found');
    // return session.accessToken;
    throw new Error('OAuth tokens not yet implemented. Configure GitHub OAuth.');
  }

  /**
   * Get token from configured source
   * source: 'env' (environment variables), 'user' (encrypted user secrets), 'oauth' (session)
   */
  async getToken(
    type: 'npm' | 'github',
    source: 'env' | 'user' | 'oauth' = 'env',
    userId?: string
  ): Promise<string> {
    let token: string;

    try {
      switch (source) {
        case 'env':
          token = await this.loadEnvToken(
            type === 'npm' ? 'NPM_TOKEN' : 'GITHUB_TOKEN'
          );
          break;

        case 'user':
          if (!userId) {
            throw new Error('userId required for user secret source');
          }
          token = await this.loadUserSecret(
            userId,
            type === 'npm' ? 'npm_token' : 'github_token'
          );
          break;

        case 'oauth':
          if (type !== 'github') {
            throw new Error('OAuth only available for GitHub tokens');
          }
          if (!userId) {
            throw new Error('userId required for OAuth source');
          }
          token = await this.loadOAuthToken(userId);
          break;

        default:
          throw new Error(`Unknown token source: ${source}`);
      }

      console.info(
        `✓ Retrieved ${type} token from ${source} source (${sanitize(token)})`
      );
      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `✗ Failed to get ${type} token from ${source} source: ${errorMsg}`
      );
      throw error;
    }
  }

  /**
   * Derive encryption key from user ID (deterministic per user)
   * In production, combine with a server-side secret
   */
  private deriveMasterKey(userId: string): Buffer {
    const appSecret = process.env.APP_ENCRYPTION_KEY || 'default-insecure-key';
    return crypto
      .pbkdf2Sync(`${appSecret}:${userId}`, 'salt', 100000, 32, 'sha256');
  }

  /**
   * Encrypt sensitive value
   */
  encrypt(plaintext: string, userId: string): { encrypted: string; iv: string; authTag: string } {
    try {
      const key = this.deriveMasterKey(userId);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      console.debug(`✓ Encrypted secret for user (${sanitize(plaintext)})`);

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      console.error('Failed to encrypt secret:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive value
   */
  decrypt(
    encryptedData: {
      encrypted: string;
      iv: string;
      authTag: string;
    },
    userId: string
  ): string {
    try {
      const key = this.deriveMasterKey(userId);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      console.debug(`✓ Decrypted secret for user`);

      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt secret (possible tampering or wrong key):', error);
      throw new Error('Failed to decrypt token. Possible data corruption or wrong decryption key.');
    }
  }

  /**
   * Check if token exists and validate format
   */
  validateTokenFormat(token: string, type: 'npm' | 'github'): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    switch (type) {
      case 'npm':
        // NPM tokens: npm_xxxx... (classic) or npm_xxxxxxxxxxx (new)
        return /^npm_[A-Za-z0-9_-]{36,40}$/.test(token);

      case 'github':
        // GitHub tokens:
        // - Personal: ghp_xxxxxxxxxxxxxxxxxxxx (legacy)
        // - Fine-grained: github_pat_xxxxxxxxxxxxxxxxxxxx
        // - App: ghu_xxxxxxxxxxxxxxxxxxxxx
        return /^(ghp_|github_pat_|ghu_)[A-Za-z0-9_]{36,255}$/.test(token);

      default:
        return false;
    }
  }

  /**
   * Audit log wrapper - logs all token operations without exposing values
   */
  async logTokenOperation(
    userId: string,
    tokenType: 'npm' | 'github',
    operation: 'publish' | 'tag' | 'release' | 'commit' | 'push',
    resourceId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // TODO: Store in TokenUsageLog table
    const level = success ? 'info' : 'error';
    const message = `[${level.toUpperCase()}] Token operation: ${operation} on ${resourceId} using ${tokenType} token (user: ${userId})`;

    if (success) {
      console.info(message);
    } else {
      console.error(`${message} - Error: ${errorMessage}`);
    }
  }

  /**
   * Check if token will expire soon
   */
  isTokenExpiringSoon(expiresAt?: Date, warningDays = 7): boolean {
    if (!expiresAt) return false;

    const now = new Date();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const warningTime = new Date(now.getTime() + warningDays * millisecondsPerDay);

    return expiresAt < warningTime;
  }

  /**
   * Sanitize logs - remove any token-like strings
   */
  sanitizeForLogging(str: string): string {
    return (
      str
        // npm tokens
        .replace(/npm_[A-Za-z0-9_-]{36,40}/g, 'npm_***REDACTED***')
        // GitHub tokens
        .replace(/gh[pua]_[A-Za-z0-9_]{36,255}/g, 'ghp_***REDACTED***')
        // Arbitrary token patterns
        .replace(/token[:\s='"]+[A-Za-z0-9_-]{20,}/gi, 'token=***REDACTED***')
    );
  }
}

export const secureTokenService = new SecureTokenService();
