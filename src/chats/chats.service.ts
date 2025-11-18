import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
  ) { }

  /**
   * Obtiene o crea un chat por par (clienteId, adminId). Idempotente gracias al índice único.
   */
  async getOrCreateByPair(
    clienteId: string,
    adminId: string,
    reservationId?: string,
  ) {
    const cId = new Types.ObjectId(clienteId);
    const aId = new Types.ObjectId(adminId);
    const rId = reservationId ? new Types.ObjectId(reservationId) : undefined;

    // Si hay reservationId, buscamos solo por reservationId (clave principal)
    const filter: FilterQuery<Chat> = rId
      ? { reservationId: rId }
      : { clienteId: cId, adminId: aId };

    console.log('[ChatsService] getOrCreateByPair filter =>', filter);

    // 1) Intentar buscar chat existente
    const existing = await this.chatModel.findOne(filter).lean();
    if (existing) {
      console.log(
        '[ChatsService] getOrCreateByPair -> existing chat',
        existing._id,
      );
      return existing;
    }

    // 2) Crear si no existe
    const payload: any = {
      clienteId: cId,
      adminId: aId,
      unreadByCliente: 0,
      unreadByAdmin: 0,
      lastMessage: {},
      ...(rId ? { reservationId: rId } : {}),
    };

    try {
      console.log('[ChatsService] getOrCreateByPair -> creating chat', payload);
      const created = await this.chatModel.create(payload);
      return created.toObject();
    } catch (err: any) {
      // Por si se corre en paralelo y el índice unique de reservationId grita
      if (err?.code === 11000) {
        console.warn(
          '[ChatsService] getOrCreateByPair duplicate key, retrying findOne...',
          err?.keyValue,
        );
        const again = await this.chatModel.findOne(filter).lean();
        if (again) return again;
      }
      throw err;
    }
  }

  async updateMeta(chatId: string, meta: Record<string, any>) {
    if (!Types.ObjectId.isValid(chatId)) throw new NotFoundException('Chat no encontrado');
    console.log('[ChatsService] updateMeta', chatId, meta);

    const chat = await this.chatModel
      .findByIdAndUpdate(
        new Types.ObjectId(chatId),
        { $set: { meta, updatedAt: new Date() } },
        { new: true },
      )
      .lean();

    if (!chat) throw new NotFoundException('Chat no encontrado');
    return chat;
  }


  /**
   * Obtiene un chat por id (valida que el usuario pertenezca al par).
   */
  async getByIdForUser(chatId: string, userId: string) {
    if (!Types.ObjectId.isValid(chatId)) {
      throw new NotFoundException('Chat no encontrado');
    }
    const chat = await this.chatModel.findById(new Types.ObjectId(chatId)).lean();
    if (!chat) {
      throw new NotFoundException('Chat no encontrado');
    }
    const uid = String(userId);
    const belongs =
      uid === String(chat.clienteId) ||
      uid === String(chat.adminId);

    if (!belongs) {
      throw new ForbiddenException('No perteneces a este chat');
    }
    return chat;
  }

  /**
   * Lista “mis chats” para un usuario (cliente o admin), ordenados por actividad.
   * Filtros básicos y paginación simple (cursor por updatedAt e _id)
   */
  async listMine(params: { userId: string; limit?: number; roleHint?: 'cliente' | 'admin' }) {
    const { userId, limit = 50, roleHint } = params;
    const u = new Types.ObjectId(userId);

    const q: FilterQuery<Chat> = roleHint === 'cliente'
      ? { clienteId: u }
      : roleHint === 'admin'
        ? { adminId: u }
        : { $or: [{ clienteId: u }, { adminId: u }] };

    const items = await this.chatModel
      .find(q)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('clienteId', 'name email')
      .populate('adminId', 'name email')
      .lean();

    return items;
  }


  /**
   * Marca como leído para el readerUserId:
   * - Setea unread del opuesto en 0
   * - No toca lastMessage (eso lo setea el envío de mensajes)
   * - La marca de lectura de mensajes se hace en MessagesService.markReadForChat()
   */
  async markRead(chatId: string, readerUserId: string) {
    if (!Types.ObjectId.isValid(chatId)) throw new NotFoundException('Chat no encontrado');
    const chat = await this.chatModel.findById(new Types.ObjectId(chatId)).select('_id clienteId adminId').lean();
    if (!chat) throw new NotFoundException('Chat no encontrado');

    const readerIsCliente = String(readerUserId) === String(chat.clienteId);
    await this.chatModel.updateOne(
      { _id: chat._id },
      {
        $set: {
          [readerIsCliente ? 'unreadByCliente' : 'unreadByAdmin']: 0,
          updatedAt: new Date(),
        },
      }
    );
  }

  async findById(id: string) {
    return `This action returns a #${id} message`;
  }
}
