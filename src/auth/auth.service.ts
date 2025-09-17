import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  // Validar credenciales (email + password)
  async validateUser(email: string, plainPassword: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(plainPassword, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const { password, ...safe } = user.toObject();
    return safe; 
  }

  // Emite JWT
  async login(user: any) {
    const payload = { 
      sub: user._id?.toString?.() ?? user.id, 
      role: user.role, 
      email: user.email 
    };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

}
