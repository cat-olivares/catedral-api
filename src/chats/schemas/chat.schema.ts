import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatDocument = HydratedDocument<Chat>;

@Schema({ _id: false })
class LastMessage {
  @Prop({ type: String, default: '' })
  contenido!: string;

  @Prop({ type: String, default: 'text' })
  tipo!: string;

  @Prop({ type: Date })
  at?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  emisor?: Types.ObjectId;
}

@Schema({ timestamps: true }) // createdAt, updatedAt
export class Chat {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  clienteId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  adminId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Reservation', index: true })
  reservationId?: Types.ObjectId;

  // Contadores de no leídos (se actualizan desde MessagesService)
  @Prop({ type: Number, default: 0 })
  unreadByCliente!: number;

  @Prop({ type: Number, default: 0 })
  unreadByAdmin!: number;

  // Snapshot del último mensaje para render en lista
  @Prop({ type: LastMessage, default: {} })
  lastMessage?: LastMessage;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, any>;

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

ChatSchema.index({ reservationId: 1 }, { unique: true, sparse: true });


// Para el listado de chats en orden de actividad
ChatSchema.index({ updatedAt: -1 });
