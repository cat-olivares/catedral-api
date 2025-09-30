import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Stock extends Document {
  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ required: true, min: 0, default: 0 })
  reserved: number;
}

export const StockSchema = SchemaFactory.createForClass(Stock);

// campo 'available' virtual (no persiste en la BD)
StockSchema.virtual('available').get(function () {
  return Math.max(0, (this.quantity ?? 0) - (this.reserved ?? 0));
});
StockSchema.set('toJSON', { virtuals: true });
StockSchema.set('toObject', { virtuals: true });