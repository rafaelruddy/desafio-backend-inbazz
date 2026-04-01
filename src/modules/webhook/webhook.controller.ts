import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('orders')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receber pedido via webhook' })
  @ApiResponse({
    status: 202,
    description: 'Pedido aceito para processamento',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  receiveOrder(@Body() dto: CreateOrderDto) {
    return this.webhookService.receive(dto);
  }
}
