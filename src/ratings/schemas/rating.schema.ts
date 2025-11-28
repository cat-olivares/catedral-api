import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RatingDocument = HydratedDocument<Rating>;

@Schema({ timestamps: true })
export class Rating {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Reservation', required: false })
  reservation?: Types.ObjectId;

  @Prop({ type: Number, min: 1, max: 5, required: true })
  value!: number;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

RatingSchema.index({ user: 1, product: 1 }, { unique: true });
