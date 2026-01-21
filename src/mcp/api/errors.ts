/**
 * API Error Classes
 * Custom error types for API communication
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string = 'Validation failed', public errors?: any[]) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends APIError {
  constructor(message: string = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends APIError {
  constructor(message: string = 'Request timeout') {
    super(message, 408);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded', public retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}
