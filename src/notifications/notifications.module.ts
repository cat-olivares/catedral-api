import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema},
    ]),
  ],
})
export class NotificationsModule {}
