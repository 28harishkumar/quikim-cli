/**
 * Quikim - Retry Helper Utility
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Retry options for exponential backoff
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  verbose?: boolean;
  /** When set, called for verbose log lines instead of writing to console */
  onLog?: (message: string) => void;
}

/**
 * Default retry options (onLog is optional)
 */
const DEFAULT_RETRY_OPTIONS: Omit<Required<RetryOptions>, "onLog"> & { onLog?: (message: string) => void } = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ENETUNREACH",
    "EAI_AGAIN",
    "fetch failed",
    "network timeout",
    "Network request failed",
  ],
  verbose: false,
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as NodeJS.ErrnoException).code;
  
  // Check if error message or code matches retryable patterns
  return retryableErrors.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
    (errorCode && errorCode.toLowerCase().includes(pattern.toLowerCase()))
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableErrors)) {
        if (opts.verbose && opts.onLog) {
          opts.onLog("[retry] Error is not retryable, failing immediately");
        }
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === opts.maxAttempts) {
        if (opts.verbose && opts.onLog) {
          opts.onLog(`[retry] Max attempts (${opts.maxAttempts}) reached, failing`);
        }
        break;
      }

      // Log retry attempt
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (opts.verbose && opts.onLog) {
        opts.onLog(`[retry] Attempt ${attempt}/${opts.maxAttempts} failed: ${errorMsg}`);
        opts.onLog(`[retry] Retrying in ${delay}ms...`);
      }

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // All retries failed, throw the last error
  throw lastError;
}

/**
 * Retry a network request with exponential backoff
 * Specialized version for fetch requests
 */
export async function retryNetworkRequest<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    ...options,
  });
}
