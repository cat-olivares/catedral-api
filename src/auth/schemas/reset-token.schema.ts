import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ versionKey: false, timestamps: true })
export class ResetToken extends Document {
  @Prop({ required: true })
  token: string;
  
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  expDate: Date;
}   

export const ResetTokenSchema = SchemaFactory.createForClass(ResetToken);