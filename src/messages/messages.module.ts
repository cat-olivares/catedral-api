import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/messages.schema';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ChatsModule } from 'src/chats/chats.module';
import { Schema as MongooseSchema } from 'mongoose';
import { Chat } from 'src/chats/schemas/chat.schema';

// Importamos el modelo 'Chat' por nombre para poder actualizar unread/lastMessage
const ChatSchema = new MongooseSchema({}, { strict: false }); // solo para inyectar el modelo por nombre

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Chat.name, schema: ChatSchema },
    ]),
    ChatsModule,
  ],
})
export class MessagesModule {}
