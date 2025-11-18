import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto, ListMessagesDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateMessageDto } from './dto/update-message.dto';

function getUserId(req: any): string | undefined {
  return req?.user?.sub || req?.user?.id || req?.user?._id || req?.user?.userId;
}

@Controller('chats/:chatId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async create(@Param('chatId') chatId: string, @Body() dto: CreateMessageDto, @Req() req: any) {
    const emisorId = getUserId(req);
    if (!emisorId) {
      throw new UnauthorizedException('Token sin userId válido');
    }
    const msg = await this.messagesService.createForChat({ chatId, emisorId, dto });
    return { ok: true, data: msg };
  }

  @Get()
  async list(@Param('chatId') chatId: string, @Query() q: ListMessagesDto) {
    const data = await this.messagesService.listByChat(chatId, q.before, q.limit);
    return { ok: true, data };
  }

  // @Get()
  // findAll() {
  //   return this.messagesService.findAll();
  // }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messagesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    return this.messagesService.update(+id, updateMessageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.messagesService.remove(+id);
  }
}
