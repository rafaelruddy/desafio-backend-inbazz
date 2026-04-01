import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaOrderRepository } from '../../infrastructure/repositories/orders.repository';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PrismaOrderRepository],
})
export class OrdersModule {}
