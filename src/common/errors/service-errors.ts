/**
 * Custom error classes for service-level errors.
 *
 * These errors help distinguish between:
 * - Service unavailability (circuit breaker open, throttling) -> Jobs should FAIL and retry
 * - LLM response issues (bad JSON, validation) -> Jobs can return degraded results
 */

/**
 * Indicates external service is unavailable (circuit open, timeout, rate limit)
 * Jobs should FAIL and retry when this is thrown.
 *
 * Use cases:
 * - Circuit breaker is open (BrokenCircuitError)
 * - Bulkhead queue is full (BulkheadRejectedError)
 * - AWS throttling (429 ThrottlingException)
 * - Service unavailable (503)
 */
export class ServiceUnavailableError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly originalError: Error,
    public readonly isRetryable: boolean = true,
  ) {
    super(`${serviceName} service unavailable: ${originalError.message}`);
    this.name = 'ServiceUnavailableError';

    // Preserve original stack trace
    if (originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Indicates LLM returned bad/unparseable response.
 * Jobs can return degraded results, should NOT fail the job.
 *
 * Use cases:
 * - LLM returned invalid JSON
 * - Response failed schema validation
 * - Response missing required fields
 */
export class LlmResponseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = 'LlmResponseError';
  }
}

/**
 * Thrown when waiting in bulkhead queue times out.
 * This is a RETRYABLE error - the service works, just overloaded.
 *
 * Use case:
 * - Bulkhead at capacity (maxConcurrent + maxQueue reached)
 * - Waited up to timeoutMs for a slot
 * - No slot became available → throw this error
 * - BullMQ will retry the job after backoff (35s)
 */
export class RetryableBulkheadTimeoutError extends Error {
  public readonly isRetryable = true;

  constructor(
    message: string,
    public readonly serviceName: string,
  ) {
    super(message);
    this.name = 'RetryableBulkheadTimeoutError';
  }
}
