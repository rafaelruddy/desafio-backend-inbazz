import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AuthTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token de autenticação não fornecido');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Formato de token inválido. Use: Bearer <token>',
      );
    }

    const expectedToken = this.configService.get<string>('WEBHOOK_SECRET');

    if (!expectedToken) {
      throw new UnauthorizedException(
        'WEBHOOK_SECRET não configurado no servidor',
      );
    }

    if (token !== expectedToken) {
      throw new UnauthorizedException('Token inválido');
    }

    return true;
  }
}
