import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ViaCepService } from './viacep.service';

@Module({
  imports: [HttpModule],
  providers: [ViaCepService],
  exports: [ViaCepService],
})
export class ViaCepModule {}
