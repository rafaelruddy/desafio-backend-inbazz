import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, of, tap } from 'rxjs';
import Redis from 'ioredis';
import { Request } from 'express';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly ttl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.ttl = this.config.get<number>('IDEMPOTENCY_TTL', 86400);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.body?.idempotency_key;

    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return of(JSON.parse(cached));
    }

    const acquired = await this.redis.set(cacheKey, '', 'EX', this.ttl, 'NX');

    if (!acquired) {
      const racedCache = await this.redis.get(cacheKey);
      return of(racedCache ? JSON.parse(racedCache) : { status: 'already_received' });
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.redis.set(
          cacheKey,
          JSON.stringify(response),
          'EX',
          this.ttl,
        );
      }),
    );
  }
}
