import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from './create-notification.dto';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @IsDateString()
  @IsOptional()
  readAt?: string;

  @IsDateString()
  @IsOptional()
  deliveredAt?: string;
}
