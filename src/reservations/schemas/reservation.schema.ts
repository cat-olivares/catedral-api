import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReservationDocument = HydratedDocument<Reservation>;

@Schema({ timestamps: true })
export class Reservation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;

  @Prop({ type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED'], default: 'PENDING' })
  status!: 'PENDING' | 'CONFIRMED' | 'CANCELLED';

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Chat' }] })
  chatId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'ReservationDetail' }] })
  reservationDetail!: Types.ObjectId[];
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);