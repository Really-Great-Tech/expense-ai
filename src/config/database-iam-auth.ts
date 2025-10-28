import { Signer } from '@aws-sdk/rds-signer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * RDS IAM Authentication Token Manager
 *
 * Manages IAM authentication tokens for Amazon Aurora database connections.
 * Implements token caching, automatic refresh, and retry logic to handle
 * connection pooling efficiently.
 *
 * Key Features:
 * - Token caching with 10-minute refresh cycle (tokens expire after 15 minutes)
 * - Exponential backoff retry logic for token generation failures
 * - Thread-safe token generation (prevents multiple simultaneous token requests)
 * - Comprehensive error handling and logging
 * - Supports both MySQL and PostgreSQL Aurora clusters
 *
 * Best Practices Implemented:
 * - Tokens are cached to reduce AWS API calls and avoid throttling
 * - Automatic refresh before expiration prevents authentication failures
 * - Connection pooling friendly (generates token only when needed)
 * - SSL/TLS required for IAM authentication
 */

interface RDSSignerConfig {
  hostname: string;
  port: number;
  username: string;
  region: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class RDSIAMAuthManager {
  private static readonly logger = new Logger('RDSIAMAuthManager');

  // Token cache - tokens expire after 15 minutes, we refresh at 10 minutes
  private static tokenCache: Map<string, TokenCache> = new Map();

  // Lock to prevent multiple simultaneous token generation requests
  private static tokenGenerationLocks: Map<string, Promise<string>> = new Map();

  // Token validity window (10 minutes in milliseconds)
  // Refresh tokens 5 minutes before actual expiration for safety
  private static readonly TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000;

  // Retry configuration
  private static readonly MAX_RETRIES = 3;
  private static readonly INITIAL_RETRY_DELAY = 100; // milliseconds

  /**
   * Generates or retrieves a cached IAM authentication token
   *
   * @param config RDS Signer configuration
   * @returns Promise resolving to authentication token
   */
  static async getAuthToken(config: RDSSignerConfig): Promise<string> {
    const cacheKey = this.getCacheKey(config);

    // Check if we have a valid cached token
    const cachedToken = this.getCachedToken(cacheKey);
    if (cachedToken) {
      this.logger.debug(`Using cached IAM token for ${config.hostname}`);
      return cachedToken;
    }

    // Check if token generation is already in progress for this config
    const existingRequest = this.tokenGenerationLocks.get(cacheKey);
    if (existingRequest) {
      this.logger.debug(`Waiting for in-progress token generation for ${config.hostname}`);
      return existingRequest;
    }

    // Generate new token
    const tokenPromise = this.generateTokenWithRetry(config, cacheKey);
    this.tokenGenerationLocks.set(cacheKey, tokenPromise);

    try {
      const token = await tokenPromise;
      return token;
    } finally {
      // Clean up lock after generation completes (success or failure)
      this.tokenGenerationLocks.delete(cacheKey);
    }
  }

  /**
   * Generates authentication token with exponential backoff retry logic
   */
  private static async generateTokenWithRetry(
    config: RDSSignerConfig,
    cacheKey: string,
    attempt: number = 1,
  ): Promise<string> {
    try {
      this.logger.log(
        `Generating new IAM auth token for ${config.hostname} (attempt ${attempt}/${this.MAX_RETRIES})`,
      );

      const signer = new Signer({
        hostname: config.hostname,
        port: config.port,
        username: config.username,
        region: config.region,
      });

      const token = await signer.getAuthToken();

      // Cache the token with expiration time
      const expiresAt = Date.now() + this.TOKEN_REFRESH_INTERVAL;
      this.tokenCache.set(cacheKey, { token, expiresAt });

      this.logger.log(
        `✅ Successfully generated IAM token for ${config.hostname}. ` +
        `Token cached until ${new Date(expiresAt).toISOString()}`,
      );

      return token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If we haven't exhausted retries, try again with exponential backoff
      if (attempt < this.MAX_RETRIES) {
        const delayMs = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);

        this.logger.warn(
          `Failed to generate IAM token (attempt ${attempt}/${this.MAX_RETRIES}): ${errorMessage}. ` +
          `Retrying in ${delayMs}ms...`,
        );

        await this.sleep(delayMs);
        return this.generateTokenWithRetry(config, cacheKey, attempt + 1);
      }

      // All retries exhausted
      this.logger.error(
        `❌ Failed to generate IAM token after ${this.MAX_RETRIES} attempts: ${errorMessage}`,
      );

      throw new Error(
        `Failed to generate RDS IAM authentication token: ${errorMessage}. ` +
        'Please verify:\n' +
        '1. IAM authentication is enabled on the Aurora cluster\n' +
        '2. The database user exists and has rds_iam role granted\n' +
        '3. IAM policy allows rds-db:connect for this resource\n' +
        '4. AWS credentials are properly configured\n' +
        '5. Network connectivity to RDS endpoint',
      );
    }
  }

  /**
   * Retrieves a cached token if valid, otherwise returns null
   */
  private static getCachedToken(cacheKey: string): string | null {
    const cached = this.tokenCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    const now = Date.now();

    // Check if token is still valid
    if (now < cached.expiresAt) {
      const remainingMs = cached.expiresAt - now;
      const remainingMinutes = Math.floor(remainingMs / 60000);

      this.logger.debug(
        `Token is valid for ${remainingMinutes} more minutes`,
      );

      return cached.token;
    }

    // Token expired, remove from cache
    this.logger.debug('Cached token expired, generating new token');
    this.tokenCache.delete(cacheKey);
    return null;
  }

  /**
   * Generates a unique cache key for the RDS configuration
   */
  private static getCacheKey(config: RDSSignerConfig): string {
    return `${config.region}:${config.hostname}:${config.port}:${config.username}`;
  }

  /**
   * Utility function for async sleep
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clears the token cache (useful for testing or forcing token refresh)
   */
  static clearCache(): void {
    this.tokenCache.clear();
    this.logger.log('Token cache cleared');
  }

  /**
   * Gets current cache statistics (useful for monitoring)
   */
  static getCacheStats(): { size: number; entries: Array<{ key: string; expiresAt: Date }> } {
    const entries = Array.from(this.tokenCache.entries()).map(([key, cache]) => ({
      key,
      expiresAt: new Date(cache.expiresAt),
    }));

    return {
      size: this.tokenCache.size,
      entries,
    };
  }
}

/**
 * Factory function to create a TypeORM-compatible password generator
 * This function can be used directly in TypeORM configuration
 *
 * @param configService NestJS ConfigService instance
 * @returns Function that generates IAM auth token or returns static password
 */
export function createPasswordProvider(configService: ConfigService) {
  const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';

  if (!useIAMAuth) {
    // Return static password for traditional authentication
    const password = configService.get<string>('MYSQL_PASSWORD');
    return () => password;
  }

  // Return IAM token generator for IAM authentication
  const hostname = configService.get<string>('MYSQL_HOST');
  const port = parseInt(configService.get<string>('MYSQL_PORT', '3306'), 10);
  const username = configService.get<string>('MYSQL_USER');
  const region = configService.get<string>('AWS_REGION', 'us-east-1');

  if (!hostname || !username || !region) {
    throw new Error(
      'Missing required IAM authentication configuration: ' +
      'MYSQL_HOST, MYSQL_USER, and AWS_REGION must be set when MYSQL_IAM_AUTH_ENABLED=true',
    );
  }

  const signerConfig: RDSSignerConfig = {
    hostname,
    port,
    username,
    region,
  };

  return async () => {
    return RDSIAMAuthManager.getAuthToken(signerConfig);
  };
}

/**
 * Synchronous wrapper for TypeORM MySQL driver
 * MySQL2 driver doesn't support async password providers, so we need
 * to generate the token synchronously during connection initialization
 */
export function createMySQLPasswordProvider(configService: ConfigService) {
  const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';

  if (!useIAMAuth) {
    // Return static password for traditional authentication
    const password = configService.get<string>('MYSQL_PASSWORD');
    return password;
  }

  // For MySQL with IAM auth, we need to use connection pool events
  // to generate tokens. This is handled in the database.ts configuration.
  // For now, return a placeholder that will be overridden
  return 'IAM_AUTH_TOKEN_PLACEHOLDER';
}
