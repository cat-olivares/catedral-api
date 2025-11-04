// src/realtime/realtime.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { ChatsModule } from '../chats/chats.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET }),
    ChatsModule,
    MessagesModule,
  ],
  providers: [ChatGateway, WsJwtGuard],
})
export class RealtimeModule {}
