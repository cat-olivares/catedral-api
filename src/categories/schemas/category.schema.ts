import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema()
export class Category extends Document {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  name: string;

  @Prop({ required: false })
  description?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
