import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto, ReadChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// import { InjectModel } from '@nestjs/mongoose';
// import { Chat, ChatDocument } from './schemas/chat.schema';
// import { Model } from 'mongoose';

function getUserId(req: any): string {
  return req?.user?.sub || req?.user?.id || req?.user?._id || req?.user?.userId;
}

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}
  /*constructor(
    private readonly chatsService: ChatsService,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
  ) {}*/

  /**
   * Crea u obtiene un chat por par (clienteId, adminId).
   * Se usa desde:
   * - front al abrir un chat por primera vez
   * - handler de push (resuelve chatId por userId par)
   */
  @Post()
  async createOrGet(@Body() dto: CreateChatDto) {
    const chat = await this.chatsService.getOrCreateByPair(dto.clienteId, dto.adminId);
    return { ok: true, data: chat };
  }

  /**
   * Lista "mis chats" (del usuario autenticado).
   * Puedes pasar roleHint=cliente|admin para optimizar el query.
   */
  @Get()
  async listMine(@Req() req: any, @Query('roleHint') roleHint?: 'cliente' | 'admin') {
    const userId = getUserId(req);
    const data = await this.chatsService.listMine({ userId, roleHint });
    return { ok: true, data };
  }
  
  /** Obtiene un chat específico (si pertenezco al par) */
  @Get(':chatId')
  async getOne(@Param('chatId') chatId: string, @Req() req: any) {
    const userId = getUserId(req);
    const data = await this.chatsService.getByIdForUser(chatId, userId);
    return { ok: true, data };
  }

  /**
   * Marca leídos para el lector actual (resetea unread del lado correspondiente).
   * La marca de readAt de los mensajes está en MessagesService.markReadForChat()
   */
  @Post(':chatId/read')
  async read(@Param('chatId') chatId: string, @Body() body: any, @Req() req: any) {
    const tokenUserId = getUserId(req);
    const readerUserId = body?.readerUserId ?? tokenUserId;
    await this.chatsService.markRead(chatId, readerUserId);
    return { ok: true };
  }

  /*@Get(':chatId/__debug_raw')
  async debugRaw(@Param('chatId') chatId: string) {
    const data = await this.chatModel.findById(chatId).lean();
    return { ok: true, data };
  }*/
}
