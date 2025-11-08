import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceTokenDocument = HydratedDocument<DeviceToken>;

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}

@Schema({ timestamps: true, versionKey: false })
export class DeviceToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // token FCM
  @Prop({ type: String, required: true, unique: true })
  token: string;

  @Prop({ type: String, enum: Object.values(DevicePlatform), default: DevicePlatform.WEB })
  platform?: DevicePlatform;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;

  // para limpieza de tokens obsoletos
  @Prop({ type: Date })
  lastSeenAt?: Date;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

// índice para tokens activos por usuario
DeviceTokenSchema.index({ userId: 1, isActive: 1 });
