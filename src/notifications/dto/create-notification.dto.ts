import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationChannel, NotificationType } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @IsMongoId()
  userId: string; // destinatario

  @IsMongoId()
  @IsOptional()
  reservationId?: string;

  @IsOptional()
  data?: Record<string, any>;
}
