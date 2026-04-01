import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { OrderStatus } from '@prisma/client';

import { PrismaOrderRepository } from '../../infrastructure/repositories/orders.repository';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { ViaCepService } from '../../integrations/viacep/viacep.service';
import { OrderJobData } from '../../common/order.types';

@Processor('orders-enrichment')
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly orderRepository: PrismaOrderRepository,
    private readonly exchangeRate: ExchangeRateService,
    private readonly viaCep: ViaCepService,
    @InjectQueue('orders-enrichment-dlq')
    private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<OrderJobData>): Promise<void> {
    const { orderId } = job.data;

    this.logger.log(`Processing ${orderId} — attempt ${job.attemptsMade + 1}`);

    const order = await this.persistIfNeeded(job.data);

    await this.orderRepository.updateStatus(orderId, OrderStatus.PROCESSING, {
      retryCount: job.attemptsMade,
    });

    const [convertedTotals, address] = await Promise.all([
      this.exchangeRate.convert(order.currency, Number(order.totalAmount)),
      this.viaCep.lookup(order.address!.cep),
    ]);

    await this.orderRepository.updateStatus(orderId, OrderStatus.ENRICHED, {
      enrichmentResult: {
        convertedTotals,
        address,
        enrichedAt: new Date(),
        enrichedBy: 'exchangerate-api.com,viacep.com.br',
      },
    });

    this.logger.log(`Order ${orderId} enriched successfully`);
  }

  private async persistIfNeeded(data: OrderJobData) {
    const existing = await this.orderRepository.findById(data.orderId);
    if (existing) return existing;

    return this.orderRepository.create(data.orderId, {
      externalId: data.externalId,
      idempotencyKey: data.idempotencyKey,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      address: data.address,
      items: data.items,
      currency: data.currency,
      totalAmount: data.totalAmount,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<OrderJobData>, error: Error): Promise<void> {
    const { orderId } = job.data;
    const maxAttempts = job.opts.attempts ?? 4;
    const isLastAttempt = job.attemptsMade >= maxAttempts;

    this.logger.warn(
      `Order ${orderId} failed (${job.attemptsMade}/${maxAttempts}): ${error.message}`,
    );

    if (!isLastAttempt) return;

    this.logger.error(`Order ${orderId} exhausted retries — moving to DLQ`);

    await Promise.all([
      this.orderRepository.updateStatus(
        orderId,
        OrderStatus.FAILED_ENRICHMENT,
        { failureReason: error.message },
      ),
      this.dlq.add(
        'failed-order',
        {
          orderId,
          error: error.message,
          failedAt: new Date().toISOString(),
        },
        { removeOnComplete: false, removeOnFail: false },
      ),
    ]);
  }
}
