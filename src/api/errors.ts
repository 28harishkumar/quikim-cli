/**
 * Quikim - CLI API Errors
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/** Base API error */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "APIError";
  }
}

/** Authentication failed error */
export class AuthenticationError extends APIError {
  constructor(message = "Authentication failed") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

/** Resource not found error */
export class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/** Network error */
export class NetworkError extends APIError {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

/** Timeout error */
export class TimeoutError extends APIError {
  constructor(message = "Request timed out") {
    super(message, 408);
    this.name = "TimeoutError";
  }
}

/** Validation error */
export class ValidationError extends APIError {
  constructor(message = "Validation failed") {
    super(message, 400);
    this.name = "ValidationError";
  }
}
