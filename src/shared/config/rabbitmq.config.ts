import { ConfigService } from '@nestjs/config';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

export const getRabbitMQConfig = (
  configService: ConfigService,
  queueName: string,
): MicroserviceOptions => ({
  transport: Transport.RMQ,
  options: {
    urls: [
      configService.get<string>(
        'RABBITMQ_URL',
        'amqp://guest:guest@localhost:5672',
      ),
    ],
    queue: queueName,
    queueOptions: {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour TTL
      },
    },
    socketOptions: {
      heartbeatIntervalInSeconds: 60,
      reconnectTimeInSeconds: 5,
    },
    prefetchCount: 10, // Process 10 messages at a time
    // Explicitly configure exchange for better routing
    noAck: false, // Enable manual acknowledgment
  },
});

export const getRabbitMQClientConfig = (
  configService: ConfigService,
): any => ({
  transport: Transport.RMQ,
  options: {
    urls: [
      configService.get<string>(
        'RABBITMQ_URL',
        'amqp://guest:guest@localhost:5672',
      ),
    ],
    queueOptions: {
      durable: true,
    },
    // Explicit exchange configuration for publishing
    // NestJS will use the pattern as routing key
  },
});

