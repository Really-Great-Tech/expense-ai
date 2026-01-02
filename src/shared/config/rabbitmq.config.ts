import { ConfigService } from '@nestjs/config';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

export const getRabbitMQConfig = (
  configService: ConfigService,
  queueName: string,
): MicroserviceOptions => {
  const exchange = configService.get<string>('RABBITMQ_EXCHANGE', '');
  
  return {
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
      noAck: false, // Enable manual acknowledgment
      // Configure exchange if provided
      ...(exchange && { exchange }),
    },
  };
};

export const getRabbitMQClientConfig = (
  configService: ConfigService,
): any => {
  const exchange = configService.get<string>('RABBITMQ_EXCHANGE', '');
  
  return {
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
      // Configure exchange if provided (for publishing)
      ...(exchange && { exchange }),
    },
  };
};

