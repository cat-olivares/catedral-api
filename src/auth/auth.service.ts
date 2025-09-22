import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResetToken } from './schemas/reset-token.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectModel(ResetToken.name)
    private resetTokenModel: Model<ResetToken>,
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

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.usersService.findByIdWithPassword(userId);
    console.log(user);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const passwordMatches = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    await this.usersService.update(userId, { password: newPassword });
    return { message: 'Contraseña actualizada correctamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (user) {
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      console.log(`Token de reseteo para ${email}: ${resetToken}`);
      await this.resetTokenModel.create({
        userId: user._id,
        token: resetToken,
        expDate: new Date(Date.now() + 3600000) // 1 hora
      });

      // enviar email con el token
    } 
    return { message: 'Si el email existe, se ha enviado un enlace para restablecer la contraseña' };
  }

}
