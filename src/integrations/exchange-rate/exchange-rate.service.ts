import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly apiUrl: string;
  private readonly targetCurrencies: string[];

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('EXCHANGE_API_URL')!;
    this.targetCurrencies = this.config
      .get<string>('TARGET_CURRENCIES', 'BRL,EUR')
      .split(',');
  }

  async convert(
    currency: string,
    amount: number,
  ): Promise<{ currency: string; amount: number }[]> {
    this.logger.log(`Fetching rates for ${currency}`);

    const { data } = await firstValueFrom(
      this.http.get(`${this.apiUrl}/${currency}`),
    );

    const rates: Record<string, number> = data.rates;

    return this.targetCurrencies
      .filter((c) => rates[c])
      .map((c) => ({
        currency: c,
        amount: parseFloat((amount * rates[c]).toFixed(2)),
      }));
  }
}
