import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import { AuthTokenGuard } from '../../common/guards/auth-token.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('orders')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Receber pedido via webhook' })
  @ApiResponse({
    status: 202,
    description: 'Pedido aceito para processamento',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticação inválido ou ausente',
  })
  receiveOrder(@Body() dto: CreateOrderDto) {
    return this.webhookService.receive(dto);
  }
}
