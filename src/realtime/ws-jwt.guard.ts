// src/realtime/ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException,} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

@Injectable()
export class WsJwtGuard implements CanActivate {
constructor(private readonly jwt: JwtService) {}

canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const client = context.switchToWs().getClient();
    const token =
    client?.handshake?.auth?.token ||
    client?.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) throw new UnauthorizedException('WS token missing');

    try {
    const payload = this.jwt.verify(token);
    // normaliza el userId y algo de info útil
    client.data.user = {
        sub: payload?.sub || payload?.id || payload?._id || payload?.userId,
        role: payload?.role,
        email: payload?.email,
    };
    if (!client.data.user.sub) throw new Error('No sub in token');
    return true;
    } catch {
    throw new UnauthorizedException('WS token invalid');
    }
}
}
