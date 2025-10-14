import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { ReservationDetail } from './reservation-detail.schema';


@Schema({ timestamps: true })
export class Reservation extends Document{
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;

  @Prop({ type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED'], default: 'PENDING' })
  status!: 'PENDING' | 'CONFIRMED' | 'CANCELLED';

  @Prop({ type: [{ type: Types.ObjectId, ref: ReservationDetail.name }] })
  reservationDetail!: Types.ObjectId[];
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);