import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Schema()
export class User extends Document {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    email: string;

    @Prop({ required: true, trim: true })
    phone: string;

    @Prop({ required: true, select: false })
    password: string;

    @Prop({ required: true, enum: ['admin', 'customer'], default: 'customer' })
    role: 'admin' | 'customer';
}

//export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

const SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS ? parseInt(process.env.BCRYPT_SALT_ROUNDS) : 10;

async function hashIfNeeded(update: any) {
    if (!update) return update;

    if (update.password) {
        update.password = await bcrypt.hash(update.password, SALT_ROUNDS);
    }
    if (update.$set?.password){
        update.$set.password = await bcrypt.hash(update.$set.password, SALT_ROUNDS);
    }
    return update;
}
    
UserSchema.pre('save', async function (next) {
    const doc = this as User;
    if (!doc.isModified('password')) {
        return next();
    }
    doc.password = await bcrypt.hash(doc.password, SALT_ROUNDS);
    next();
});

UserSchema.pre('findOneAndUpdate', async function (next) {
    const update: any = this.getUpdate();
    await hashIfNeeded(update);
    this.setUpdate(update);
    next();
});

UserSchema.pre('updateOne', async function (next) {
  const update: any = this.getUpdate();
  await hashIfNeeded(update);
  this.setUpdate(update);
  next();
});


UserSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    return ret;
  },
});