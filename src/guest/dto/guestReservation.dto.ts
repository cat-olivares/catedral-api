// src/reservations/dto/guestReservation.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class GuestReservationItemDto {
  @IsString()
  @IsNotEmpty()
  product: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateGuestReservationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestReservationItemDto)
  reservationDetail: GuestReservationItemDto[];
}
