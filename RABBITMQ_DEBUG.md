# RabbitMQ Debugging Guide

## Issue: Events Not Being Received

If you're emitting events but not seeing them consumed, check the following:

### 1. Verify Microservice Connection

Check your application logs for:
```
RabbitMQ microservice connected to queue: expense-ai-queue
```

If you don't see this, the microservice isn't connected.

### 2. Check Event Pattern Matching

**Important**: The event pattern in `@EventPattern()` must **exactly match** the pattern used in `emit()`.

- ✅ Correct: `emit('receipt.processing.requested', data)` → `@EventPattern('receipt.processing.requested')`
- ❌ Wrong: `emit('receipt.processing.requested', data)` → `@EventPattern('receipt.extracted')`

### 3. Verify Queue Creation

Check RabbitMQ Management UI (http://localhost:15672):
1. Go to "Queues" tab
2. Look for queue: `expense-ai-queue`
3. Check if it has consumers (should show "1" consumer)
4. Check message count - if messages are accumulating, they're not being consumed

### 4. Check Exchange and Routing

NestJS RabbitMQ uses:
- **Default Exchange**: Messages are routed using the pattern as routing key
- **Queue Binding**: The queue is bound to the exchange with the pattern as routing key

### 5. Debug Steps

1. **Add logging to verify consumer is registered:**
   ```typescript
   @EventPattern(ReceiptEventPattern.PROCESSING_REQUESTED)
   async handleReceiptProcessingRequested(...) {
     console.log('🎯 Consumer method called!'); // Add this first line
     // ... rest of handler
   }
   ```

2. **Check if microservice started:**
   Look for: `RabbitMQ microservice connected to queue: expense-ai-queue`

3. **Verify event pattern:**
   Make sure you're using the enum:
   ```typescript
   this.rabbitClient.emit(ReceiptEventPattern.PROCESSING_REQUESTED, data);
   // NOT: this.rabbitClient.emit('receipt.processing.requested', data);
   ```

4. **Check RabbitMQ Management UI:**
   - Go to http://localhost:15672
   - Login with guest/guest
   - Check "Queues" → `expense-ai-queue`
   - Check "Exchanges" → Look for default exchange
   - Check "Bindings" → Verify queue is bound to exchange

### 6. Common Issues

**Issue**: Events published but not consumed
- **Cause**: Queue not bound to exchange, or pattern mismatch
- **Fix**: Restart application, verify pattern matches exactly

**Issue**: "Successfully connected to RMQ broker" but no consumption
- **Cause**: Consumer not registered, or wrong event pattern
- **Fix**: Check `@EventPattern()` decorator matches emit pattern

**Issue**: Messages accumulating in queue
- **Cause**: Consumer not acknowledging messages, or consumer crashed
- **Fix**: Check error logs, verify `channel.ack(originalMsg)` is called

### 7. Testing Event Flow

1. **Emit event:**
   ```typescript
   this.rabbitClient.emit(ReceiptEventPattern.PROCESSING_REQUESTED, {
     receiptId: 'test-123',
     // ... other fields
   });
   ```

2. **Check logs for:**
   ```
   Received receipt.processing.requested event for receipt test-123
   ```

3. **If no log appears:**
   - Check RabbitMQ Management UI for messages in queue
   - Verify consumer is registered (check queue consumers count)
   - Restart application

### 8. Manual Queue Inspection

In RabbitMQ Management UI:
1. Go to "Queues" → `expense-ai-queue`
2. Click "Get messages"
3. Set "Ack mode" to "Nack message requeue true"
4. Click "Get Message(s)"
5. Check the routing key and payload

The routing key should match your event pattern exactly.

