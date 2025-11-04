import { UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from './ws-jwt.guard';
import { ChatsService } from '../chats/chats.service';
import { MessagesService } from '../messages/messages.service';
import { TipoMensaje } from '../messages/schemas/messages.schema';

type NewMessagePayload = {
  chatId: string;
  tempId?: string;
  contenido: string;
  tipo?: TipoMensaje;
  meta?: Record<string, any>;
};

type ChatIdPayload = { chatId: string };

@WebSocketGateway({
    namespace: '/chat',
    cors: { origin: true, credentials: true },
})
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server!: Server;

    // presencia básica: userId -> sockets count
    private online = new Map<string, number>();

    constructor(
        private readonly chats: ChatsService,
        private readonly messages: MessagesService,
    ) {}

    // lifecycle
    async handleConnection(client: Socket) {
        const userId = client.data.user.sub as string;

        // room por usuario (para enviarle notificaciones de lista de chats, etc.)
        client.join(`user:${userId}`);

        // presencia
        const n = (this.online.get(userId) || 0) + 1;
        this.online.set(userId, n);
        this.server.to(`user:${userId}`).emit('presence:update', { userId, online: true, sockets: n });
    }

    async handleDisconnect(client: Socket) {
        const userId = client.data.user?.sub as string;
        if (!userId) return;

        const n = Math.max((this.online.get(userId) || 1) - 1, 0);
        if (n === 0) {
        this.online.delete(userId);
        this.server.to(`user:${userId}`).emit('presence:update', { userId, online: false, sockets: 0 });
        } else {
        this.online.set(userId, n);
        this.server.to(`user:${userId}`).emit('presence:update', { userId, online: true, sockets: n });
        }
    }

    // chat:join / chat:leave
    @SubscribeMessage('chat:join')
    async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;

        // valida pertenencia
        await this.chats.getByIdForUser(chatId, userId);

        client.join(`chat:${chatId}`);
        client.emit('chat:joined', { chatId });

        // (opcional) notifica a otros en el chat
        client.to(`chat:${chatId}`).emit('presence:inChat', { chatId, userId, joined: true });
    }

    @SubscribeMessage('chat:leave')
    async onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        client.leave(`chat:${chatId}`);
        client.emit('chat:left', { chatId });
        client.to(`chat:${chatId}`).emit('presence:inChat', { chatId, userId, joined: false });
    }

    // message:new (con ACK por tempId)
    @SubscribeMessage('message:new')
    async onNewMessage(@ConnectedSocket() client: Socket, @MessageBody() body: NewMessagePayload) {
        const userId = client.data.user.sub as string;
        const { chatId, tempId, contenido, tipo, meta } = body;

        // valida pertenencia (lanza 404/403 si no)
        await this.chats.getByIdForUser(chatId, userId);

        // persiste usando tu service existente
        const created = await this.messages.createForChat({
            chatId,
            emisorId: userId,
            dto: { contenido, tipo, meta },
        });

        // ACK solo al emisor (reemplazar tempId en el front)
        client.emit('message:ack', { tempId, message: created });

        // broadcast a todos en el room del chat (incluyendo emisor si quieres duplicar)
        this.server.to(`chat:${chatId}`).emit('message:new', { message: created });
    }

    // chat:read
    @SubscribeMessage('chat:read')
    async onChatRead(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;

        await this.chats.getByIdForUser(chatId, userId);

        // marca readAt en mensajes del otro y counters en chat
        await this.messages.markReadForChat({ chatId, readerUserId: userId });
        await this.chats.markRead(chatId, userId);

        const at = new Date().toISOString();
        // notifica a la sala del chat
        this.server.to(`chat:${chatId}`).emit('chat:read', { chatId, byUserId: userId, at });
    }

    // message:delivered
    @SubscribeMessage('message:delivered')
    async onDelivered(@ConnectedSocket() _client: Socket, @MessageBody() body: { messageIds: string[] }) {
        if (!body?.messageIds?.length) return;
        await this.messages.markDelivered(body.messageIds);
        this.server.emit('message:delivered', { ids: body.messageIds, at: new Date().toISOString() });
    }

    // typing:start / typing:stop
    @SubscribeMessage('typing:start')
    async onTypingStart(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        await this.chats.getByIdForUser(chatId, userId);
        client.to(`chat:${chatId}`).emit('typing', { chatId, userId, state: 'start' });
    }

    @SubscribeMessage('typing:stop')
    async onTypingStop(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        await this.chats.getByIdForUser(chatId, userId);
        client.to(`chat:${chatId}`).emit('typing', { chatId, userId, state: 'stop' });
    }
}
