# Bedrock Rate Limiter Implementation

## Overview

This document describes the implementation of a rate limiter for AWS Bedrock API calls to prevent hitting service quotas and rate limits.

## Problem

The expense-ai system processes documents using multiple AI agents in parallel. Each document triggers 5+ simultaneous Bedrock API calls (classification, extraction, quality assessment, etc.). With 10 BullMQ workers processing jobs concurrently, this can result in 50+ simultaneous Bedrock calls, easily exceeding API rate limits.

### Before Rate Limiter
```
10 Workers × 5 Agents = 50 simultaneous Bedrock calls → Rate Limit Error! ❌
```

### After Rate Limiter
```
10 Workers × 5 Agents = 50 calls → Rate Limiter queues excess calls ✅
Only 5 SONNET_4, 10 NOVA_PRO, 20 NOVA_MICRO calls active at once
Remaining calls wait in queue (don't fail!)
```

## Solution Architecture

### Components

1. **BedrockRateLimiterService** (`src/resilience/bedrock-rate-limiter.service.ts`)
   - Per-model rate limiting using p-limit semaphore pattern
   - Separate limits for each model profile
   - Automatic queuing when at capacity

2. **Integration Point** (`src/services/bedrock/bedrock-llm.ts`)
   - Rate limiter wraps `chat()` method
   - Flow: RateLimiter → CircuitBreaker → AWS SDK → Bedrock

3. **Health Checks** (`src/health/indicators/circuit-breaker.health.ts`)
   - Exposes metrics via health endpoints
   - Shows active calls, queued calls, utilization per model

### Per-Model Limits

| Model Profile | Concurrent Limit | Use Case |
|---------------|-----------------|----------|
| SONNET_4      | 5               | Classification (expensive, slow) |
| SONNET_4_5    | 5               | Advanced reasoning |
| NOVA_PRO      | 10              | Extraction, quality, compliance (balanced) |
| NOVA_MICRO    | 20              | Citations (cheap, fast) |

## How It Works

### Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Agent calls llm.chat()                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. BedrockLlmService.chat()                                  │
│    - Gets profileKey (SONNET_4, NOVA_PRO, etc.)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Rate Limiter (NEW!)                                       │
│    - Check if model has available slots                      │
│    - If YES: Proceed immediately                             │
│    - If NO: Wait in queue (async, non-blocking)             │
│    - When slot available: Resume execution                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Circuit Breaker (existing)                                │
│    - Fail fast if Bedrock degraded                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. AWS SDK (existing)                                        │
│    - 4 retries with adaptive backoff                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. AWS Bedrock API                                           │
│    - No rate limit errors! ✅                                │
└─────────────────────────────────────────────────────────────┘
```

### Waiting Mechanism

When a model reaches its limit:

```typescript
// Example: 50 SONNET_4 calls hit at once

Rate Limiter Status:
┌────────────────────────────────┐
│ SONNET_4 (limit: 5)            │
│ Active: 5                      │
│ Waiting: 45  ← Jobs wait here! │
└────────────────────────────────┘

As calls complete:
1. Call #1 finishes → activeCount becomes 4
2. Call #6 automatically moves from queue → activeCount becomes 5
3. Process continues until all 50 complete
```

**Important:** Jobs don't fail - they wait asynchronously!

## Implementation Details

### Rate Limiter Service

```typescript
// src/resilience/bedrock-rate-limiter.service.ts

export class BedrockRateLimiterService {
  // Separate p-limit instance per model
  private limiters: Map<ProfileKey, PLimitFunction>;
  
  async executeWithLimit<T>(
    profileKey: ProfileKey,
    fn: () => Promise<T>
  ): Promise<T> {
    const limiter = this.limiters.get(profileKey);
    
    // Wait here if at capacity (non-blocking)
    return limiter(fn);
  }
  
  // Metrics for monitoring
  getMetrics(profileKey: ProfileKey): RateLimiterMetrics {
    return {
      profile: profileKey,
      activeCount: limiter.activeCount,   // Currently running
      pendingCount: limiter.pendingCount, // Waiting in queue
      limit: config.concurrency,          // Max allowed
    };
  }
}
```

### Integration with BedrockLlmService

```typescript
// src/services/bedrock/bedrock-llm.ts

async chat(options: { messages: ChatMessage[] }): Promise<ChatResponse> {
  const rateLimiter = getGlobalRateLimiterService();
  const circuitBreaker = getGlobalCircuitBreakerService().getBedrockBreaker();

  // NEW: Rate limiter wraps entire call
  return await rateLimiter.executeWithLimit(this.profileKey, async () => {
    // Existing circuit breaker logic
    return await circuitBreaker.execute(async () => {
      // ... Bedrock API call
    });
  });
}
```

## Monitoring & Metrics

### Health Check Endpoint

```bash
GET /health
```

Response includes rate limiter metrics:

```json
{
  "rateLimiter": {
    "status": "up",
    "summary": {
      "totalActive": 15,
      "totalPending": 8,
      "hasQueuedRequests": true
    },
    "models": [
      {
        "profile": "SONNET_4",
        "active": 5,
        "pending": 3,
        "limit": 5,
        "utilizationPercent": 100
      },
      {
        "profile": "NOVA_PRO",
        "active": 10,
        "pending": 5,
        "limit": 10,
        "utilizationPercent": 100
      },
      {
        "profile": "NOVA_MICRO",
        "active": 0,
        "pending": 0,
        "limit": 20,
        "utilizationPercent": 0
      }
    ]
  }
}
```

### Key Metrics

- **activeCount**: Number of currently running Bedrock calls
- **pendingCount**: Number of calls waiting in queue
- **utilizationPercent**: (active / limit) × 100
- **hasQueuedRequests**: Boolean flag if any model has pending requests

## Configuration

### Default Limits

Configured in `BedrockRateLimiterService`:

```typescript
private readonly defaultLimits: Record<ProfileKey, number> = {
  SONNET_4: 5,      // Conservative for expensive models
  SONNET_4_5: 5,
  NOVA_PRO: 10,     // Balanced
  NOVA_MICRO: 20,   // Higher for fast models
};
```

### Dynamic Adjustment

Limits can be updated at runtime:

```typescript
rateLimiterService.updateLimit('NOVA_PRO', 15);
```

### Future: Environment Variables

To add environment-based configuration:

```bash
# .env
BEDROCK_RATE_LIMIT_SONNET_4=5
BEDROCK_RATE_LIMIT_NOVA_PRO=10
BEDROCK_RATE_LIMIT_NOVA_MICRO=20
```

## Benefits

### ✅ Prevents Rate Limit Errors
- Hard cap on concurrent calls per model
- No more 429 (Too Many Requests) errors

### ✅ Jobs Don't Fail
- Excess calls wait in queue
- Automatic resumption when capacity available
- No job retries needed

### ✅ Per-Model Control
- Different limits for different models
- Optimal resource utilization
- NOVA_MICRO can run 20 concurrent while SONNET_4 limited to 5

### ✅ Maintains Parallelism
- Worker concurrency unchanged (still 10)
- Parallel agent processing unchanged
- Only Bedrock calls are rate limited

### ✅ Observable
- Real-time metrics via health checks
- Monitor queue depths
- Track utilization per model

### ✅ Zero Code Changes to Agents
- Transparent integration
- Agents unaware of rate limiting
- Works with existing code

## Testing

### Unit Tests

```bash
npm test src/resilience/bedrock-rate-limiter.service.spec.ts
```

### Integration Test

Run load test to verify rate limiting:

```bash
# Upload multiple documents simultaneously
# Monitor health endpoint to see queueing in action
GET /health
```

Expected behavior:
- Active calls capped at limits
- Pending count increases under load
- All jobs eventually complete successfully

## Troubleshooting

### Issue: Calls Still Hitting Rate Limits

**Check:**
1. Verify rate limiter is initialized (check logs for "Rate limiter initialized")
2. Check limits are appropriate for your Bedrock quotas
3. Monitor metrics to see if queue is working

### Issue: Jobs Taking Too Long

**Possible Causes:**
1. Limits set too low - increase if Bedrock quota allows
2. High volume of requests - this is expected, jobs will queue
3. Check if circuit breaker is open (separate issue)

**Solution:**
```typescript
// Increase limits if Bedrock quota supports it
rateLimiterService.updateLimit('NOVA_PRO', 15);
```

### Issue: Memory Usage High

**Cause:** Very large queue (many pending requests)

**Solution:**
1. Check if Bedrock is responding slowly (causing backlog)
2. Consider reducing worker concurrency temporarily
3. Monitor `pendingCount` in health checks

## Files Modified/Created

### New Files
- `src/resilience/bedrock-rate-limiter.service.ts` - Rate limiter service
- `src/resilience/bedrock-rate-limiter.service.spec.ts` - Unit tests
- `BEDROCK_RATE_LIMITER.md` - This documentation

### Modified Files
- `src/resilience/index.ts` - Export rate limiter
- `src/resilience/resilience.module.ts` - Register service
- `src/services/bedrock/bedrock-llm.ts` - Integrate rate limiter
- `src/health/indicators/circuit-breaker.health.ts` - Add metrics

## Future Enhancements

### 1. Environment-Based Configuration
Add support for configuring limits via environment variables.

### 2. Adaptive Limits
Automatically adjust limits based on observed Bedrock performance and error rates.

### 3. Cross-Region Load Balancing
Distribute requests across multiple AWS regions to increase effective quotas.

### 4. Request Prioritization
Allow high-priority requests to jump the queue.

### 5. Metrics Dashboard
Create dedicated dashboard for visualizing rate limiter metrics over time.

## References

- **p-limit Documentation**: Internal implementation at `src/tools/p-limit/`
- **Circuit Breaker**: `src/resilience/circuit-breaker.service.ts`
- **Bedrock Service**: `src/services/bedrock/bedrock-llm.ts`
- **Health Checks**: `src/health/indicators/`

## Support

For questions or issues:
1. Check health endpoint for rate limiter status
2. Review logs for rate limiter messages
3. Monitor metrics to understand queueing behavior
4. Adjust limits based on your Bedrock quotas

---

**Implementation Date:** January 8, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
