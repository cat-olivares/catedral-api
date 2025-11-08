import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; 
import { ChatsModule } from '../chats/chats.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    AuthModule,
    ChatsModule,
    MessagesModule,
  ],
  providers: [ChatGateway],
})
export class RealtimeModule {}
