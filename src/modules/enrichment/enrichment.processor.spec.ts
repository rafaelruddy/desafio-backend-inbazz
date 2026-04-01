import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderStatus } from '@prisma/client';

import { EnrichmentProcessor } from './enrichment.processor';
import { PrismaOrderRepository } from '../../infrastructure/repositories/orders.repository';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { ViaCepService } from '../../integrations/viacep/viacep.service';
import { OrderJobData } from '../../common/order.types';

const makeJobData = (): OrderJobData => ({
  orderId: 'uuid-123',
  externalId: 'ext-001',
  idempotencyKey: 'idem-001',
  customerEmail: 'ana@example.com',
  customerName: 'Ana',
  address: { cep: '01001-000', number: '100' },
  items: [{ sku: 'SKU1', qty: 2, unit_price: 59.9 }],
  currency: 'USD',
  totalAmount: 119.8,
});

const makeJob = (overrides: Partial<Job> = {}): Job =>
  ({
    data: makeJobData(),
    attemptsMade: 0,
    opts: { attempts: 4 },
    ...overrides,
  }) as unknown as Job;

describe('EnrichmentProcessor', () => {
  let processor: EnrichmentProcessor;
  let orderRepo: {
    findById: jest.Mock;
    create: jest.Mock;
    updateStatus: jest.Mock;
  };
  let exchangeRate: { convert: jest.Mock };
  let viaCep: { lookup: jest.Mock };
  let dlq: { add: jest.Mock };

  const order = {
    id: 'uuid-123',
    currency: 'USD',
    totalAmount: 119.8,
    address: { cep: '01001-000' },
  };

  const convertedTotals = [
    { currency: 'BRL', amount: 612.18 },
    { currency: 'EUR', amount: 109.62 },
  ];

  const address = {
    street: 'Praça da Sé',
    neighborhood: 'Sé',
    city: 'São Paulo',
    state: 'SP',
  };

  beforeEach(async () => {
    orderRepo = {
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(order),
      updateStatus: jest.fn(),
    };
    exchangeRate = { convert: jest.fn().mockResolvedValue(convertedTotals) };
    viaCep = { lookup: jest.fn().mockResolvedValue(address) };
    dlq = { add: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        EnrichmentProcessor,
        { provide: PrismaOrderRepository, useValue: orderRepo },
        { provide: ExchangeRateService, useValue: exchangeRate },
        { provide: ViaCepService, useValue: viaCep },
        { provide: getQueueToken('orders-enrichment-dlq'), useValue: dlq },
      ],
    }).compile();

    processor = module.get(EnrichmentProcessor);
  });

  describe('quando o enriquecimento tem sucesso', () => {
    it('persiste o pedido, converte moeda, busca endereço e marca ENRICHED', async () => {
      orderRepo.findById.mockResolvedValue(null);

      await processor.process(makeJob());

      expect(orderRepo.create).toHaveBeenCalledWith(
        'uuid-123',
        expect.any(Object),
      );
      expect(exchangeRate.convert).toHaveBeenCalledWith('USD', 119.8);
      expect(viaCep.lookup).toHaveBeenCalledWith('01001-000');
      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        'uuid-123',
        OrderStatus.ENRICHED,
        {
          enrichmentResult: expect.objectContaining({
            convertedTotals,
            address,
          }),
        },
      );
    });
  });

  describe('quando é retry e o pedido já existe no banco', () => {
    it('não persiste novamente, apenas enriquece', async () => {
      orderRepo.findById.mockResolvedValue(order);

      await processor.process(makeJob({ attemptsMade: 1 }));

      expect(orderRepo.create).not.toHaveBeenCalled();
      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        'uuid-123',
        OrderStatus.ENRICHED,
        expect.any(Object),
      );
    });
  });

  describe('quando o enriquecimento falha', () => {
    it('propaga a exceção para o BullMQ acionar retry', async () => {
      orderRepo.findById.mockResolvedValue(order);
      exchangeRate.convert.mockRejectedValue(new Error('timeout'));

      await expect(processor.process(makeJob())).rejects.toThrow('timeout');
    });
  });

  describe('quando todas as tentativas se esgotam', () => {
    it('move para DLQ e marca FAILED_ENRICHMENT', async () => {
      const job = makeJob({ attemptsMade: 4, opts: { attempts: 4 } });

      await processor.onFailed(job, new Error('service unavailable'));

      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        'uuid-123',
        OrderStatus.FAILED_ENRICHMENT,
        { failureReason: 'service unavailable' },
      );
      expect(dlq.add).toHaveBeenCalledWith(
        'failed-order',
        expect.objectContaining({ orderId: 'uuid-123' }),
        expect.any(Object),
      );
    });
  });

  describe('quando não é a última tentativa', () => {
    it('não envia para DLQ nem atualiza status final', async () => {
      const job = makeJob({ attemptsMade: 2, opts: { attempts: 4 } });

      await processor.onFailed(job, new Error('transient error'));

      expect(dlq.add).not.toHaveBeenCalled();
      expect(orderRepo.updateStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        OrderStatus.FAILED_ENRICHMENT,
        expect.anything(),
      );
    });
  });
});
