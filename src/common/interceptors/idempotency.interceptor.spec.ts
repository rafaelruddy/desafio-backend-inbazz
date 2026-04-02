import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, lastValueFrom } from 'rxjs';

import { IdempotencyInterceptor } from './idempotency.interceptor';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';

const mockExecutionContext = (body: Record<string, any>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  }) as any;

const mockCallHandler = (response: any): CallHandler => ({
  handle: () => of(response),
});

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    redis = { get: jest.fn(), set: jest.fn() };

    const config = { get: () => 86400 } as any as ConfigService;
    interceptor = new IdempotencyInterceptor(redis as any, config);
  });

  it('deixa passar quando não há idempotency_key no body', async () => {
    const ctx = mockExecutionContext({});
    const handler = mockCallHandler({ status: 'received', orderId: 'abc' });

    const result$ = await interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$);

    expect(redis.get).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'received', orderId: 'abc' });
  });

  it('retorna resposta cacheada quando idempotency_key já existe', async () => {
    const cached = JSON.stringify({ status: 'received', orderId: 'existing-uuid' });
    redis.get.mockResolvedValue(cached);

    const ctx = mockExecutionContext({ idempotency_key: 'idem-001' });
    const handler = mockCallHandler(null);

    const result$ = await interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$);

    expect(redis.get).toHaveBeenCalledWith('idempotency:idem-001');
    expect(result).toEqual({ status: 'received', orderId: 'existing-uuid' });
  });

  it('executa o handler e cacheia a resposta quando é request nova', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    const handlerResponse = { status: 'received', orderId: 'new-uuid' };
    const ctx = mockExecutionContext({ idempotency_key: 'idem-002' });
    const handler = mockCallHandler(handlerResponse);

    const result$ = await interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$);

    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:idem-002',
      '',
      'EX',
      86400,
      'NX',
    );
    expect(result).toEqual(handlerResponse);

    // aguarda o tap async completar
    await new Promise((r) => setTimeout(r, 10));

    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:idem-002',
      JSON.stringify(handlerResponse),
      'EX',
      86400,
    );
  });

  it('retorna already_received quando perde a race condition no SET NX', async () => {
    redis.get.mockResolvedValueOnce(null);
    redis.set.mockResolvedValue(null);
    const racedResponse = JSON.stringify({ status: 'received', orderId: 'raced-uuid' });
    redis.get.mockResolvedValueOnce(racedResponse);

    const ctx = mockExecutionContext({ idempotency_key: 'idem-003' });
    const handler = mockCallHandler(null);

    const result$ = await interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$);

    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:idem-003',
      '',
      'EX',
      86400,
      'NX',
    );
    expect(result).toEqual({ status: 'received', orderId: 'raced-uuid' });
  });
});
