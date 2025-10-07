// src/reservations/dtos/create-reservation.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsMongoId, IsNumber, Min, ValidateNested, } from 'class-validator';

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export class CreateReservationDetailDto {
  @IsMongoId()
  product!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  subtotal!: number;
}

export class CreateReservationDto {
  @IsMongoId()
  user!: string;

  @IsEnum(ReservationStatus)
  status!: ReservationStatus;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReservationDetailDto)
  reservationDetail!: CreateReservationDetailDto[];
}