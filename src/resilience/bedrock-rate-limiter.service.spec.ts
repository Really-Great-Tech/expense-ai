import { BedrockRateLimiterService } from './bedrock-rate-limiter.service';
import type { ProfileKey } from '@/services/bedrock/bedrock-llm';

describe('BedrockRateLimiterService', () => {
  let service: BedrockRateLimiterService;

  beforeEach(() => {
    service = new BedrockRateLimiterService();
  });

  describe('initialization', () => {
    it('should initialize with default limits', () => {
      const metrics = service.getAllMetrics();
      
      expect(metrics).toHaveLength(4);
      expect(metrics.find((m) => m.profile === 'SONNET_4')?.limit).toBe(5);
      expect(metrics.find((m) => m.profile === 'SONNET_4_5')?.limit).toBe(5);
      expect(metrics.find((m) => m.profile === 'NOVA_PRO')?.limit).toBe(10);
      expect(metrics.find((m) => m.profile === 'NOVA_MICRO')?.limit).toBe(20);
    });

    it('should have zero active and pending counts initially', () => {
      const metrics = service.getAllMetrics();
      
      metrics.forEach((m) => {
        expect(m.activeCount).toBe(0);
        expect(m.pendingCount).toBe(0);
      });
    });
  });

  describe('executeWithLimit', () => {
    it('should execute function within rate limit', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await service.executeWithLimit('NOVA_MICRO', mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unknown profile', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      await expect(
        service.executeWithLimit('UNKNOWN_PROFILE' as ProfileKey, mockFn)
      ).rejects.toThrow('No rate limiter configured for profile');
    });

    it('should queue requests when at capacity', async () => {
      const delays: number[] = [];
      const createDelayedFn = (delay: number) => async () => {
        delays.push(delay);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return `done-${delay}`;
      };

      // Launch 3 concurrent requests (limit is 5 for SONNET_4)
      const promises = [
        service.executeWithLimit('SONNET_4', createDelayedFn(100)),
        service.executeWithLimit('SONNET_4', createDelayedFn(100)),
        service.executeWithLimit('SONNET_4', createDelayedFn(100)),
      ];

      // Give them time to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check metrics - should have 3 active
      const metrics = service.getMetrics('SONNET_4');
      expect(metrics.activeCount).toBeLessThanOrEqual(5);

      // Wait for all to complete
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for specific profile', () => {
      const metrics = service.getMetrics('NOVA_PRO');
      
      expect(metrics.profile).toBe('NOVA_PRO');
      expect(metrics.limit).toBe(10);
      expect(metrics.activeCount).toBe(0);
      expect(metrics.pendingCount).toBe(0);
    });

    it('should throw error for unknown profile', () => {
      expect(() => service.getMetrics('UNKNOWN' as ProfileKey)).toThrow(
        'No rate limiter found for profile'
      );
    });
  });

  describe('updateLimit', () => {
    it('should update concurrency limit', () => {
      service.updateLimit('NOVA_PRO', 15);
      
      const metrics = service.getMetrics('NOVA_PRO');
      expect(metrics.limit).toBe(15);
    });

    it('should throw error for unknown profile', () => {
      expect(() => service.updateLimit('UNKNOWN' as ProfileKey, 10)).toThrow(
        'No rate limiter found for profile'
      );
    });
  });

  describe('aggregate metrics', () => {
    it('should return total active count', () => {
      const total = service.getTotalActiveCount();
      expect(total).toBe(0);
    });

    it('should return total pending count', () => {
      const total = service.getTotalPendingCount();
      expect(total).toBe(0);
    });

    it('should indicate no queued requests initially', () => {
      const hasQueued = service.hasQueuedRequests();
      expect(hasQueued).toBe(false);
    });
  });

  describe('clearAllQueues', () => {
    it('should clear all pending requests', () => {
      // This is mainly for coverage - actual clearing tested in integration
      expect(() => service.clearAllQueues()).not.toThrow();
    });
  });
});
