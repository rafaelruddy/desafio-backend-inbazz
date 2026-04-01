import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnrichmentProcessor } from './enrichment.processor';
import { PrismaOrderRepository } from '../../infrastructure/repositories/orders.repository';
import { ExchangeRateModule } from '../../integrations/exchange-rate/exchange-rate.module';
import { ViaCepModule } from '../../integrations/viacep/viacep.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'orders-enrichment-dlq' }),
    ExchangeRateModule,
    ViaCepModule,
  ],
  providers: [EnrichmentProcessor, PrismaOrderRepository],
})
export class EnrichmentModule {}
