import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { OrdersModule } from './modules/orders/orders.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,

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
})
export class AppModule {}
