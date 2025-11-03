import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum TipoMensaje {
  TEXT = 'text',
  IMG = 'img',
  FILE = 'file',
}

export enum EstadoMensaje {
  ENVIADO = 'enviado',
  ENTREGADO = 'entregado',
  LEIDO = 'leido',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true, index: true })
  chat!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  emisor!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TipoMensaje), default: TipoMensaje.TEXT })
  tipo!: TipoMensaje;

  @Prop({ type: String, trim: true, default: '' })
  contenido!: string;

  @Prop({ type: String, enum: Object.values(EstadoMensaje), default: EstadoMensaje.ENVIADO })
  estado!: EstadoMensaje;

  @Prop({ type: Date })
  deliveredAt?: Date;

  @Prop({ type: Date })
  readAt?: Date;

  // Contexto liviano (ej: reserva asociada)
  @Prop({ type: Object, default: {} })
  meta?: {
    reservationId?: string;
    [k: string]: any;
  };

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Índice compuesto para scroll/paginación
MessageSchema.index({ chat: 1, createdAt: -1 });
