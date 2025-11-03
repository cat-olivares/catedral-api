import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Message, MessageDocument, EstadoMensaje } from './schemas/messages.schema';
import { Model, Types } from 'mongoose';

// Tipado mínimo para operar sobre Chat (sin importar su schema completo)
type ChatDoc = {
  _id: Types.ObjectId;
  clienteId: Types.ObjectId;
  adminId: Types.ObjectId;
  unreadByCliente: number;
  unreadByAdmin: number;
  lastMessage?: {
    contenido: string;
    tipo: string;
    at: Date;
    emisor: Types.ObjectId;
  };
  updatedAt?: Date;
};

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel('Chat') private readonly chatModel: Model<ChatDoc & Document>,
  ) {}

  async createForChat(params: {chatId: string; emisorId: string; dto: CreateMessageDto;}) {
    const { chatId, emisorId, dto } = params;

    const chat = await this.chatModel.findById(chatId).select('_id clienteId adminId').lean();
    if (!chat) {
      throw new NotFoundException('Chat no encontrado');
    }

    const isCliente = String(emisorId) === String(chat.clienteId);
    const isAdmin = String(emisorId) === String(chat.adminId);

    if (!isCliente && !isAdmin) {
      throw new ForbiddenException('El usuario no pertenece a este chat');
    }

    const created = await this.messageModel.create({
      chat: new Types.ObjectId(chatId),
      emisor: new Types.ObjectId(emisorId),
      tipo: dto.tipo ?? 'text',
      contenido: dto.contenido,
      meta: dto.meta ?? {},
      estado: EstadoMensaje.ENVIADO,
      createdAt: new Date(),
    });

    await this.chatModel.updateOne(
      { _id: chatId },
      {
        $set: {
          lastMessage: {
            contenido: dto.contenido,
            tipo: dto.tipo ?? 'text',
            at: created.createdAt,
            emisor: created.emisor as any,
          },
          updatedAt: new Date(),
        },
        $inc: {
          [isCliente ? 'unreadByAdmin' : 'unreadByCliente']: 1,
        },
      },
    );

    return created;
  }
  
  async listByChat(chatId: string, before?: string, limit = 50) {
    const q: any = { chat: new Types.ObjectId(chatId) };
    if (before) q.createdAt = { $lt: new Date(before) };

    const items = await this.messageModel.find(q).sort({ createdAt: -1 }).limit(limit).lean();

    // Devolvemos orden cronológico ascendente para pintar en UI sin invertir
    return items.reverse();
  }

  // Utilidades para socket / futuros endpoints
  async markDelivered(messageIds: string[]) {
    const now = new Date();
    await this.messageModel.updateMany(
      { _id: { $in: messageIds.map((id) => new Types.ObjectId(id)) }, deliveredAt: { $exists: false } },
      { $set: { deliveredAt: now, estado: EstadoMensaje.ENTREGADO } },
    );
  }

  async markReadForChat(params: { chatId: string; readerUserId: string }) {
    const { chatId, readerUserId } = params;

    const chat = await this.chatModel.findById(chatId).select('_id clienteId adminId').lean();
    if (!chat) throw new NotFoundException('Chat no encontrado');

    // const readerIsCliente = new Types.ObjectId(readerUserId).equals(chat.clienteId);
    const readerIsCliente = String(readerUserId) === String(chat.clienteId);

    const filter = {
      chat: new Types.ObjectId(chatId),
      // solo mensajes del otro emisor que aún no tienen readAt
      emisor: readerIsCliente ? chat.adminId : chat.clienteId,
      readAt: { $exists: false },
    };

    const now = new Date();
    await this.messageModel.updateMany(filter, { $set: { readAt: now, estado: EstadoMensaje.LEIDO } });

    // reset unread del lector opuesto
    await this.chatModel.updateOne(
      { _id: chatId },
      { $set: { [readerIsCliente ? 'unreadByCliente' : 'unreadByAdmin']: 0, updatedAt: now } },
    );
  }


  findAll() {
    return `This action returns all messages`;
  }

  findOne(id: number) {
    return `This action returns a #${id} message`;
  }

  update(id: number, updateMessageDto: UpdateMessageDto) {
    return `This action updates a #${id} message`;
  }

  remove(id: number) {
    return `This action removes a #${id} message`;
  }

}
