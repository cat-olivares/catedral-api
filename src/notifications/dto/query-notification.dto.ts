import { IsBooleanString, IsEnum, IsMongoId, IsNumberString, IsOptional } from 'class-validator';
import { NotificationType } from '../schemas/notification.schema';

export class QueryNotificationsDto {
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsBooleanString()
  @IsOptional()
  unreadOnly?: string; // 'true' | 'false'

  @IsOptional()
  fromDate?: string;

  @IsOptional()
  toDate?: string;

  @IsNumberString()
  @IsOptional()
  page?: string

  @IsNumberString()
  @IsOptional()
  per_page?: string;
}
