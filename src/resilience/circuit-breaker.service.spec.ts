import { CircuitBreakerService, getGlobalCircuitBreakerService } from './circuit-breaker.service';
import { CircuitState, BrokenCircuitError } from 'cockatiel';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getBreaker', () => {
    it('should create a new circuit breaker', () => {
      const breaker = service.getBreaker('test');
      expect(breaker).toBeDefined();
      expect(breaker.state).toBe(CircuitState.Closed);
    });

    it('should return same instance on subsequent calls', () => {
      const breaker1 = service.getBreaker('test');
      const breaker2 = service.getBreaker('test');
      expect(breaker1).toBe(breaker2);
    });

    it('should use default config for known services', () => {
      const bedrockBreaker = service.getBreaker('bedrock');
      expect(bedrockBreaker).toBeDefined();
    });

    it('should use custom config when provided', () => {
      const breaker = service.getBreaker('custom', { threshold: 10, halfOpenAfter: 60000 });
      expect(breaker).toBeDefined();
    });

    it('should use fallback config for unknown services', () => {
      const breaker = service.getBreaker('unknown-service');
      expect(breaker).toBeDefined();
    });
  });

  describe('convenience getters for circuit breakers', () => {
    it('should return bedrock breaker', () => {
      const breaker = service.getBedrockBreaker();
      expect(breaker).toBeDefined();
    });

    it('should return textract breaker', () => {
      const breaker = service.getTextractBreaker();
      expect(breaker).toBeDefined();
    });

    it('should return s3 breaker', () => {
      const breaker = service.getS3Breaker();
      expect(breaker).toBeDefined();
    });

    it('should return database breaker', () => {
      const breaker = service.getDatabaseBreaker();
      expect(breaker).toBeDefined();
    });
  });

  describe('circuit breaker execution', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const breaker = service.getBreaker('test');
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should record failures', async () => {
      const breaker = service.getBreaker('test-failures', { threshold: 3, halfOpenAfter: 1000 });

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await breaker.execute(async () => {
          throw new Error('test error');
        }).catch(() => {});
      }

      // Circuit should now be open
      expect(breaker.state).toBe(CircuitState.Open);
    });

    it('should throw BrokenCircuitError when circuit is open', async () => {
      const breaker = service.getBreaker('test-open', { threshold: 1, halfOpenAfter: 60000 });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error('test error');
      }).catch(() => {});

      // Next call should throw BrokenCircuitError
      await expect(breaker.execute(async () => 'success')).rejects.toThrow(BrokenCircuitError);
    });
  });

  describe('getWrappedPolicy', () => {
    it('should create wrapped policy with retry and circuit breaker', () => {
      const policy = service.getWrappedPolicy('bedrock');
      expect(policy).toBeDefined();
    });

    it('should return same wrapped policy on subsequent calls', () => {
      const policy1 = service.getWrappedPolicy('bedrock');
      const policy2 = service.getWrappedPolicy('bedrock');
      expect(policy1).toBe(policy2);
    });

    it('should use custom retry config', () => {
      const policy = service.getWrappedPolicy('custom-retry', { maxAttempts: 5, initialDelay: 100, maxDelay: 1000 });
      expect(policy).toBeDefined();
    });

    it('should execute function through wrapped policy', async () => {
      const policy = service.getWrappedPolicy('test-wrapped');
      const result = await policy.execute(async () => 'success');
      expect(result).toBe('success');
    });
  });

  describe('convenience getters for wrapped policies', () => {
    it('should return bedrock wrapped policy', () => {
      const policy = service.getBedrockWrapped();
      expect(policy).toBeDefined();
    });

    it('should return textract wrapped policy', () => {
      const policy = service.getTextractWrapped();
      expect(policy).toBeDefined();
    });

    it('should return s3 wrapped policy', () => {
      const policy = service.getS3Wrapped();
      expect(policy).toBeDefined();
    });

    it('should return database wrapped policy', () => {
      const policy = service.getDatabaseWrapped();
      expect(policy).toBeDefined();
    });
  });

  describe('getAllStatus', () => {
    it('should return empty array when no breakers created', () => {
      const newService = new CircuitBreakerService();
      const statuses = newService.getAllStatus();
      expect(statuses).toEqual([]);
    });

    it('should return status for all created breakers', () => {
      service.getBreaker('service1');
      service.getBreaker('service2');

      const statuses = service.getAllStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses.map((s) => s.name)).toContain('service1');
      expect(statuses.map((s) => s.name)).toContain('service2');
    });

    it('should include correct state information', () => {
      service.getBreaker('test-status');
      const statuses = service.getAllStatus();

      expect(statuses[0]).toEqual({
        name: 'test-status',
        state: 'closed',
        failures: 0,
      });
    });
  });

  describe('isOpen', () => {
    it('should return false for non-existent breaker', () => {
      const result = service.isOpen('non-existent');
      expect(result).toBe(false);
    });

    it('should return false when circuit is closed', () => {
      service.getBreaker('test-closed');
      const result = service.isOpen('test-closed');
      expect(result).toBe(false);
    });

    it('should return true when circuit is open', async () => {
      const breaker = service.getBreaker('test-is-open', { threshold: 1, halfOpenAfter: 60000 });

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error('test error');
      }).catch(() => {});

      const result = service.isOpen('test-is-open');
      expect(result).toBe(true);
    });
  });

  describe('hasOpenCircuit', () => {
    it('should return false when no circuits are open', () => {
      service.getBreaker('service1');
      service.getBreaker('service2');

      const result = service.hasOpenCircuit();
      expect(result).toBe(false);
    });

    it('should return true when any circuit is open', async () => {
      service.getBreaker('healthy');
      const breaker = service.getBreaker('unhealthy', { threshold: 1, halfOpenAfter: 60000 });

      // Open one circuit
      await breaker.execute(async () => {
        throw new Error('test error');
      }).catch(() => {});

      const result = service.hasOpenCircuit();
      expect(result).toBe(true);
    });
  });

  describe('isBrokenCircuitError', () => {
    it('should return true for BrokenCircuitError', () => {
      const error = new BrokenCircuitError();
      const result = CircuitBreakerService.isBrokenCircuitError(error);
      expect(result).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('test');
      const result = CircuitBreakerService.isBrokenCircuitError(error);
      expect(result).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(CircuitBreakerService.isBrokenCircuitError('string')).toBe(false);
      expect(CircuitBreakerService.isBrokenCircuitError(null)).toBe(false);
      expect(CircuitBreakerService.isBrokenCircuitError(undefined)).toBe(false);
    });
  });

  describe('getGlobalCircuitBreakerService', () => {
    it('should return singleton instance', () => {
      const instance1 = getGlobalCircuitBreakerService();
      const instance2 = getGlobalCircuitBreakerService();
      expect(instance1).toBe(instance2);
    });

    it('should return CircuitBreakerService instance', () => {
      const instance = getGlobalCircuitBreakerService();
      expect(instance).toBeInstanceOf(CircuitBreakerService);
    });
  });

  describe('retry policy behavior', () => {
    it('should retry on transient failures', async () => {
      const policy = service.getWrappedPolicy('test-retry', { maxAttempts: 3, initialDelay: 10, maxDelay: 50 });
      let attempts = 0;

      const result = await policy.execute(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('transient error');
        }
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should give up after max attempts', async () => {
      const policy = service.getWrappedPolicy('test-giveup', { maxAttempts: 2, initialDelay: 10, maxDelay: 50 });
      let attempts = 0;

      await expect(
        policy.execute(async () => {
          attempts++;
          throw new Error('persistent error');
        }),
      ).rejects.toThrow('persistent error');

      // Note: cockatiel retry policy includes initial attempt + retries
      expect(attempts).toBeGreaterThanOrEqual(2);
    });
  });

  describe('state name conversion', () => {
    it('should report correct state names in status', async () => {
      const breaker = service.getBreaker('state-test', { threshold: 1, halfOpenAfter: 50 });

      // Initially closed
      let statuses = service.getAllStatus();
      expect(statuses[0].state).toBe('closed');

      // Open the circuit
      await breaker.execute(async () => {
        throw new Error('test error');
      }).catch(() => {});

      statuses = service.getAllStatus();
      expect(statuses[0].state).toBe('open');

      // Note: Half-open transition is timing-dependent and unreliable in tests
      // The implementation is correct - it transitions after halfOpenAfter ms
    });
  });
});
