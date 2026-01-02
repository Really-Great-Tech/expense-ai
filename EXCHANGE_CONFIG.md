# RabbitMQ Exchange Configuration

## Issue: "An unsupported event was received"

This error occurs when:
1. The event pattern doesn't match any registered `@EventPattern()` handler
2. The exchange/routing configuration doesn't match between producer and consumer

## Your Current Setup

Based on your logs:
- **Producer Exchange**: `receipt_exchange`
- **Event Pattern**: `receipt.processing.requested`
- **Queue**: `expense-ai-queue`

## Solution

You need to configure the consumer to use the same exchange. Add to your `.env`:

```env
RABBITMQ_EXCHANGE=receipt_exchange
```

Or if you want to use different exchanges for different event types, you can configure them in the RabbitMQ config.

## How NestJS RabbitMQ Works

1. **Default Behavior**: NestJS uses a default exchange and routes messages using the pattern as routing key
2. **Custom Exchange**: If you specify an exchange, NestJS will:
   - Create/bind to that exchange
   - Use the pattern as routing key
   - Bind the queue to the exchange with the pattern as routing key

## Verification Steps

1. **Check Exchange in RabbitMQ UI**:
   - Go to http://localhost:15672
   - Navigate to "Exchanges"
   - Look for `receipt_exchange`
   - Check its bindings

2. **Check Queue Bindings**:
   - Go to "Queues" → `expense-ai-queue`
   - Click on the queue
   - Check "Bindings" tab
   - Should show binding to `receipt_exchange` with routing key `receipt.processing.requested`

3. **Verify Consumer Registration**:
   - In queue details, check "Consumers" section
   - Should show 1 consumer
   - If 0, the consumer isn't registered

## Alternative: Use Default Exchange

If you want to use NestJS default behavior (no custom exchange), remove the exchange configuration from your producer and let NestJS handle routing automatically.



