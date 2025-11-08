import { UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from './ws-jwt.guard';
import { ChatsService } from '../chats/chats.service';
import { MessagesService } from '../messages/messages.service';
import { TipoMensaje } from '../messages/schemas/messages.schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

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

export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server!: Server;
    private readonly logger = new Logger(ChatGateway.name);
    private online = new Map<string, number>();

    constructor(
        private readonly chats: ChatsService,
        private readonly messages: MessagesService,
        private readonly jwt: JwtService,
        private readonly cfg: ConfigService, 
    ) {}
    
    async handleConnection(client: Socket) {
        const authHeader = client?.handshake?.headers?.authorization || '';
        const headerToken = authHeader.replace(/^Bearer\s+/i, '');
        const authToken = (client?.handshake?.auth as any)?.token as string;
        const queryToken = (client?.handshake?.query?.token as string) || '';
        const token = authToken || headerToken || queryToken;
        try {
            if (!token) {
                throw new Error('WS token missing');
            }
            const payload: any = this.jwt.verify(token, {
                secret: this.cfg.get<string>('JWT_SECRET'),
            });

            // Normalizar user
            const sub = payload?.sub || payload?.id || payload?._id || payload?.userId;
            if (!sub) {
                throw new Error('No user id in token');
            }
            client.data.user = {
              sub,
              role: payload?.role,
              email: payload?.email,
            };
            client.join(`user:${sub}`);
            this.logger.log(`WS connected: user=${sub} socket=${client.id}`);

        } catch (e) {
            this.logger.warn(`WS auth failed: ${e instanceof Error ? e.message : e}`);
            client.emit('error', { message: 'unauthorized' });
            client.disconnect(true);
            return;
        }
    }

    async handleDisconnect(client: Socket) {
        const userId = client.data.user?.sub as string | undefined;
        if (userId) {
            client.leave(`user:${userId}`);
        }
    }

    // chat:join / chat:leave
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('chat:join')
    async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        // valida pertenencia
        await this.chats.getByIdForUser(chatId, userId);
        client.join(`chat:${chatId}`);
        client.emit('chat:joined', { chatId });
        // opc notifica a otros en el chat
        client.to(`chat:${chatId}`).emit('presence:inChat', { chatId, userId, joined: true });
    }
    @UseGuards(WsJwtGuard)
    @SubscribeMessage('chat:leave')
    async onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        client.leave(`chat:${chatId}`);
        client.emit('chat:left', { chatId });
        client.to(`chat:${chatId}`).emit('presence:inChat', { chatId, userId, joined: false });
    }

    @UseGuards(WsJwtGuard)
    @SubscribeMessage('message:new')
    async onNewMessage(@ConnectedSocket() client: Socket, @MessageBody() body: NewMessagePayload) {
        const userId = client.data.user.sub as string;
        const { chatId, tempId, contenido, tipo, meta } = body;
        // validacion de pertenencia, lanza 403 si no
        await this.chats.getByIdForUser(chatId, userId);

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

    @UseGuards(WsJwtGuard)
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

    @UseGuards(WsJwtGuard)
    @SubscribeMessage('message:delivered')
    async onDelivered(@ConnectedSocket() _client: Socket, @MessageBody() body: { messageIds: string[] }) {
        if (!body?.messageIds?.length) return;
        await this.messages.markDelivered(body.messageIds);
        this.server.emit('message:delivered', { ids: body.messageIds, at: new Date().toISOString() });
    }

    @UseGuards(WsJwtGuard)
    @SubscribeMessage('typing:start')
    async onTypingStart(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        await this.chats.getByIdForUser(chatId, userId);
        client.to(`chat:${chatId}`).emit('typing', { chatId, userId, state: 'start' });
    }

    @UseGuards(WsJwtGuard)
    @SubscribeMessage('typing:stop')
    async onTypingStop(@ConnectedSocket() client: Socket, @MessageBody() body: ChatIdPayload) {
        const userId = client.data.user.sub as string;
        const { chatId } = body;
        await this.chats.getByIdForUser(chatId, userId);
        client.to(`chat:${chatId}`).emit('typing', { chatId, userId, state: 'stop' });
    }
}
