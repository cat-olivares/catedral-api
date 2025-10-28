import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum NotificationChannel {
  PUSH = 'push',
  IN_APP = 'inapp',
}

export enum NotificationType {
  RESERVATION_CREATED = 'RESERVATION_CREATED',
  RESERVATION_STATUS = 'RESERVATION_STATUS',
  STOCK_ALERT = 'STOCK_ALERT',
  GENERAL = 'GENERAL',
}

@Schema({ timestamps: true, versionKey: false })
export class Notification extends Document {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 180 })
  title: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    default: NotificationType.GENERAL,
    index: true,
  })
  type: NotificationType;

  @Prop({
    type: String,
    enum: Object.values(NotificationChannel),
    default: NotificationChannel.PUSH,
  })
  channel: NotificationChannel;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Reservation', required: false, index: true })
  reservationId?: Types.ObjectId;

  @Prop({ type: Object, required: false, default: {} })
  data?: Record<string, any>;

  @Prop({ type: Boolean, default: false, index: true })
  isRead: boolean;

  @Prop({ type: Date, required: false })
  readAt?: Date;

  @Prop({ type: Date, required: false })
  deliveredAt?: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: Date, required: false })
  deletedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Índices compuestos recomendados para queries típicas
NotificationSchema.index({ userId: 1, isDeleted: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
