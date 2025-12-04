# Microservices Architecture Setup

This document describes the microservices architecture implementation for the expense-ai application.

## Architecture Overview

The application is being refactored to use a microservices architecture with:
- **Shared Database**: All services connect to the same MySQL database
- **RabbitMQ**: Service-to-service communication via message queues
- **BullMQ (Redis)**: Job processing queues (existing functionality maintained)

## Current Implementation Status

### ✅ Completed

1. **Shared Events Package** (`src/shared/events/`)
   - Document events (`document.events.ts`)
   - Receipt events (`receipt.events.ts`)
   - Storage events (`storage.events.ts`)
   - Country events (`country.events.ts`)

2. **RabbitMQ Configuration** (`src/shared/config/rabbitmq.config.ts`)
   - Client configuration for publishing events
   - Microservice configuration for consuming events

3. **Document Service**
   - Added RabbitMQ client for publishing events
   - Publishes `document.uploaded` events when documents are queued

4. **Document Splitter Service**
   - Added RabbitMQ client for publishing events
   - Publishes `receipt.extracted` events when receipts are created

5. **Package Dependencies**
   - Added `@nestjs/microservices`
   - Added `amqplib` and `amqp-connection-manager`

### ✅ Completed (Continued)

6. **Document Splitter Consumer**
   - Created `DocumentSplitterConsumer` service
   - Consumes `document.uploaded` events from RabbitMQ
   - Publishes `document.split.completed` and `receipt.extracted` events

7. **Expense Processing Consumer**
   - Added RabbitMQ consumer to `ExpenseProcessor`
   - Consumes `receipt.extracted` events from RabbitMQ
   - Publishes `receipt.processing.completed` and `receipt.processing.failed` events

8. **Main Application**
   - Updated `main.ts` to connect as RabbitMQ microservice
   - Application now listens to RabbitMQ queue: `expense-ai-queue`

9. **Environment Configuration**
   - Created `.env.example` with RabbitMQ configuration

3. **Service Separation** (Future)
   - Split into separate service directories
   - Create separate `main.ts` files for each service
   - Set up independent deployment

## Event Flow

### Current Flow (Hybrid - BullMQ + RabbitMQ)

```
1. Document Upload
   ↓
2. Document Service
   - Uploads file to storage
   - Publishes: document.uploaded (RabbitMQ)
   - Adds job: expense-processing (BullMQ) [backward compatibility]
   ↓
3. Document Splitter Service (Consumer)
   - Consumes: document.uploaded (RabbitMQ)
   - Creates/splits document
   - Publishes: document.split.completed (RabbitMQ)
   - Publishes: receipt.extracted (RabbitMQ) for each receipt
   - Adds jobs: expense-processing (BullMQ) [backward compatibility]
   ↓
4. Expense Processing Service (Consumer)
   - Consumes: receipt.extracted (RabbitMQ) ✅
   - Processes receipt
   - Publishes: receipt.processing.completed (RabbitMQ)
   - Also processes via BullMQ [backward compatibility]
```

### Target Flow (Full RabbitMQ)

```
1. Document Upload
   ↓
2. Document Service
   - Uploads file to storage
   - Creates ExpenseDocument
   - Publishes: document.uploaded (RabbitMQ)
   ↓
3. Document Splitter Service (Consumer)
   - Consumes: document.uploaded
   - Splits document
   - Publishes: document.split.completed
   - Publishes: receipt.extracted (for each receipt)
   ↓
4. Expense Processing Service (Consumer)
   - Consumes: receipt.extracted
   - Processes receipt
   - Publishes: receipt.processing.completed
```

## Environment Variables

Add to your `.env` file:

```env
# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Redis (for BullMQ) - existing
REDIS_HOST=localhost
REDIS_PORT=6379

# Database (shared) - existing
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=expense_11
```

## Running RabbitMQ

### Using Docker (Recommended)

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

Access management UI at: http://localhost:15672 (guest/guest)

### Using Homebrew (macOS)

```bash
brew install rabbitmq
brew services start rabbitmq
```

## Next Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start RabbitMQ**
   - Use Docker or local installation

3. **Update .env**
   - Add `RABBITMQ_URL`

4. **Add RabbitMQ Consumers**
   - Update `main.ts` to connect as microservice
   - Add event handlers to services

5. **Test Event Flow**
   - Upload a document
   - Verify events are published
   - Verify events are consumed

## Event Patterns

### Document Events
- `document.uploaded` - Published when document is uploaded
- `document.split.completed` - Published when document is split
- `document.split.failed` - Published when splitting fails
- `document.processed` - Published when processing completes

### Receipt Events
- `receipt.extracted` - Published when receipt is extracted from document
- `receipt.processing.requested` - Published when processing is requested
- `receipt.processing.completed` - Published when processing completes
- `receipt.processing.failed` - Published when processing fails

### Storage Events
- `storage.upload.requested` - Published when upload is requested
- `storage.upload.completed` - Published when upload completes
- `storage.upload.failed` - Published when upload fails

### Country Events
- `country.validate.requested` - Published when validation is requested
- `country.validated` - Published when validation completes
- `country.policy.requested` - Published when policy is requested
- `country.policy.retrieved` - Published when policy is retrieved

## Notes

- The current implementation maintains backward compatibility with BullMQ
- Services can publish events while still using BullMQ for job processing
- Full migration to RabbitMQ-only communication can be done gradually
- Shared database allows for easy data access across services

