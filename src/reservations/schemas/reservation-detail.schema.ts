import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReservationDetailDocument = HydratedDocument<ReservationDetail>;

@Schema({ timestamps: true })
export class ReservationDetail {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  subtotal!: number;
}

export const ReservationDetailSchema = SchemaFactory.createForClass(ReservationDetail);