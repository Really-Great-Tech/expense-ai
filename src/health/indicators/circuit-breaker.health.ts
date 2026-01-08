import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CircuitBreakerService, BedrockRateLimiterService } from '../../resilience';

/**
 * Circuit Breaker Health Indicator
 *
 * Monitors the state of all circuit breakers and reports their health status.
 * Used by health check endpoints for alerting and monitoring.
 *
 * States:
 * - Closed: Normal operation, requests pass through
 * - Open: Circuit tripped, requests fail fast
 * - Half-Open: Testing if service recovered
 */
@Injectable()
export class CircuitBreakerHealthIndicator extends HealthIndicator {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly rateLimiterService: BedrockRateLimiterService,
  ) {
    super();
  }

  /**
   * Check all circuit breakers health
   * Returns unhealthy if any circuit is open
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const allStatus = this.circuitBreakerService.getAllStatus();
    const hasOpenCircuit = this.circuitBreakerService.hasOpenCircuit();

    const circuitDetails = allStatus.reduce(
      (acc, status) => {
        acc[status.name] = {
          state: status.state,
          isHealthy: status.state !== 'open',
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    const result = this.getStatus(key, !hasOpenCircuit, {
      message: hasOpenCircuit ? 'One or more circuit breakers are open' : 'All circuit breakers are healthy',
      circuits: circuitDetails,
      openCircuits: allStatus.filter((s) => s.state === 'open').map((s) => s.name),
      halfOpenCircuits: allStatus.filter((s) => s.state === 'half-open').map((s) => s.name),
    });

    if (hasOpenCircuit) {
      throw new HealthCheckError('Circuit breaker check failed', result);
    }

    return result;
  }

  /**
   * Check a specific circuit breaker
   */
  async checkCircuit(key: string, circuitName: string): Promise<HealthIndicatorResult> {
    const allStatus = this.circuitBreakerService.getAllStatus();
    const circuitStatus = allStatus.find((s) => s.name === circuitName);

    if (!circuitStatus) {
      return this.getStatus(key, true, {
        message: `Circuit breaker '${circuitName}' not initialized yet`,
        state: 'unknown',
      });
    }

    const isHealthy = circuitStatus.state !== 'open';

    const result = this.getStatus(key, isHealthy, {
      name: circuitStatus.name,
      state: circuitStatus.state,
      message: isHealthy
        ? `Circuit '${circuitName}' is ${circuitStatus.state}`
        : `Circuit '${circuitName}' is OPEN - failing fast`,
    });

    if (!isHealthy) {
      throw new HealthCheckError(`Circuit breaker '${circuitName}' is open`, result);
    }

    return result;
  }

  /**
   * Get summary of all circuit breakers (does not throw on open circuits)
   * Use this for informational endpoints that shouldn't fail
   */
  async getSummary(key: string): Promise<HealthIndicatorResult> {
    const allStatus = this.circuitBreakerService.getAllStatus();
    const openCount = allStatus.filter((s) => s.state === 'open').length;
    const halfOpenCount = allStatus.filter((s) => s.state === 'half-open').length;
    const closedCount = allStatus.filter((s) => s.state === 'closed').length;

    return this.getStatus(key, true, {
      summary: {
        total: allStatus.length,
        closed: closedCount,
        halfOpen: halfOpenCount,
        open: openCount,
      },
      circuits: allStatus.map((s) => ({
        name: s.name,
        state: s.state,
      })),
    });
  }

  /**
   * Get Bedrock rate limiter metrics
   * Shows active calls, queued calls, and limits for each model profile
   */
  async getRateLimiterMetrics(key: string): Promise<HealthIndicatorResult> {
    const allMetrics = this.rateLimiterService.getAllMetrics();
    const totalActive = this.rateLimiterService.getTotalActiveCount();
    const totalPending = this.rateLimiterService.getTotalPendingCount();
    const hasQueuedRequests = this.rateLimiterService.hasQueuedRequests();

    return this.getStatus(key, true, {
      summary: {
        totalActive,
        totalPending,
        hasQueuedRequests,
      },
      models: allMetrics.map((m) => ({
        profile: m.profile,
        active: m.activeCount,
        pending: m.pendingCount,
        limit: m.limit,
        utilizationPercent: Math.round((m.activeCount / m.limit) * 100),
      })),
    });
  }
}
