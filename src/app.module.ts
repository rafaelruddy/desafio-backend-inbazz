import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { OrdersModule } from './modules/orders/orders.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { QueueModule } from './modules/queue/queue.module';
import { CustomLogger } from './custom.logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true },
        },
      },
    }),
    PrismaModule,
    RedisModule,

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') },
      }),
    }),

    WebhookModule,
    OrdersModule,
    EnrichmentModule,
    QueueModule,
  ],
  providers: [CustomLogger],
  exports: [CustomLogger],
})
export class AppModule {}
