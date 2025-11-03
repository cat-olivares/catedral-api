import { IsEnum, IsNotEmpty, IsObject, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoMensaje } from '../schemas/messages.schema';

export class CreateMessageDto {
  @IsEnum(TipoMensaje)
  @IsOptional()
  tipo?: TipoMensaje = TipoMensaje.TEXT;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  contenido!: string;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}

export class ListMessagesDto {
  @IsOptional()
  @IsISO8601()
  before?: string; // ISO date: trae mensajes anteriores a esta fecha

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 50;
}
