import { PartialType } from '@nestjs/mapped-types';
import { CreateReservationDetailDto, CreateReservationDto, ReservationStatus } from './create-reservation.dto';
import { IsArray, IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateReservationDetailDto {
    @IsMongoId()
    product!: string;

    @IsNumber()
    @Min(1)
    quantity!: number;

    @IsNumber()
    @Min(0)
    subtotal!: number;
}

export class UpdateReservationDto {
  @IsMongoId()
  user!: string;

  @IsEnum(ReservationStatus)
  status!: ReservationStatus;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsArray()
  //@ValidateNested({ each: true })
  @Type(() => UpdateReservationDetailDto)
  reservationDetail!: UpdateReservationDetailDto[];
}


