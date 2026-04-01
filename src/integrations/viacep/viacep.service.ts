import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ViaCepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

@Injectable()
export class ViaCepService {
  private readonly logger = new Logger(ViaCepService.name);

  constructor(private readonly http: HttpService) {}

  async lookup(cep: string): Promise<ViaCepAddress> {
    const cleanCep = cep.replace('-', '');
    this.logger.log(`Looking up CEP ${cleanCep}`);

    const { data } = await firstValueFrom(
      this.http.get(`https://viacep.com.br/ws/${cleanCep}/json/`),
    );

    if (data.erro) {
      throw new Error(`CEP ${cleanCep} not found`);
    }

    return {
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  }
}
