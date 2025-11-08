import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
  ) {}

  /**
   * Obtiene o crea un chat por par (clienteId, adminId). Idempotente gracias al índice único.
   */
  async getOrCreateByPair(clienteId: string, adminId: string) {
    const cId = new Types.ObjectId(clienteId);
    const aId = new Types.ObjectId(adminId);

    // Intentar buscar
    const existing = await this.chatModel.findOne({ clienteId: cId, adminId: aId }).lean();
    if (existing) {
      return existing;
    }

    // Crear si no existe (manejar carrera con índice único)
    try {
      const created = await this.chatModel.create({
        clienteId: cId,
        adminId: aId,
        unreadByCliente: 0,
        unreadByAdmin: 0,
        lastMessage: {},
      });
      return created.toObject();
    } catch (err: any) {
      // Si otro proceso lo creo justo antes
      if (err?.code === 11000) {
        const again = await this.chatModel.findOne({ clienteId: cId, adminId: aId }).lean();
        if (again) return again;
        throw new ConflictException('Conflicto creando chat');
      }
      throw err;
    }
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

    const items = await this.chatModel.find(q).sort({ updatedAt: -1 }).limit(limit).lean();

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
