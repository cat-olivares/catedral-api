import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_SECRET', 'change-me'),
    });
  }

  async validate(payload: any) {
    // Lo que retornes aquí estará en req.user
    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}