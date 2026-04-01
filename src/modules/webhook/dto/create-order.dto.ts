import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsArray,
  IsNumber,
  IsPositive,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
  Length,
  Matches,
} from 'class-validator';

class CustomerDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ana' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

class AddressDto {
  @ApiProperty({ example: '01001-000' })
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, {
    message: 'cep must be a valid format (e.g. 01001-000 or 01001000)',
  })
  cep: string;

  @ApiProperty({ example: '100' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiPropertyOptional({ example: 'apto 42' })
  complement?: string;
}

class ItemDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  qty: number;

  @ApiProperty({ example: 59.9 })
  @IsNumber()
  @IsPositive()
  unit_price: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'ext-123' })
  @IsString()
  @IsNotEmpty()
  order_id: string;

  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ApiProperty({ type: [ItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @ApiProperty({ example: 'USD', description: 'Código ISO 4217 (3 letras)' })
  @IsString()
  @Length(3, 3, { message: 'currency must be a 3-letter code (e.g. USD, BRL)' })
  currency: string;

  @ApiProperty({ example: 'uuid-or-hash' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;
}
