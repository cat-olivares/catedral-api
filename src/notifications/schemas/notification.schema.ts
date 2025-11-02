import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  RESERVATION_CREATED = 'reservation_created',
}

export enum NotificationStatus {
  QUEUED = 'queued',   // creada y lista para enviar
  SENT = 'sent',       // enviada a FCM sin error
  FAILED = 'failed',   // error al intentar enviar
  READ = 'read',       // usuario la marcó como leída (opcional)
}

@Schema({ timestamps: true, versionKey: false })
export class Notification {
  // destinatario (en este caso, siempre ADMIN_USER_ID)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  // datos extras (por ejemplo reservationId)
  @Prop({ type: Object, default: {} })
  data?: Record<string, any>;

  // estado del envío
  @Prop({ type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.QUEUED, index: true })
  status: NotificationStatus;

  // cuándo se marcó como enviada correctamente
  @Prop({ type: Date })
  sentAt?: Date;

  // mensajes de error si falló el push
  @Prop({ type: String })
  errorMessage?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ userId: 1, status: 1 });
