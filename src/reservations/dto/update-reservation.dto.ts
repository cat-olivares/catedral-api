// src/reservations/dto/update-reservation.dto.ts
import { IsArray, IsEnum, IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationStatus } from './create-reservation.dto';

export class UpdateReservationDetailDto {
  @IsMongoId()
  @IsOptional()
  product?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  subtotal?: number;
}

export class UpdateReservationDto {
  @IsMongoId()
  @IsOptional()
  user?: string;

  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  total?: number;

  @IsArray()
  @Type(() => UpdateReservationDetailDto)
  @IsOptional()
  reservationDetail?: UpdateReservationDetailDto[];
}
