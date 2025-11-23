import { Controller, Post, Body, Get, UseGuards, Request, Put, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/login.dto';
import { UsersService } from 'src/users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) { }

  /**
   * POST /auth/login
   * - Usa LocalAuthGuard -> dispara LocalStrategy (email/password)
   * - Si valida, req.user trae al usuario (sin password)
   * - Devuelve access_token (JWT) + user
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() _dto: LoginDto, @Request() req: any) {
    return this.authService.login(req.user); // req.user viene de LocalStrategy.validate()
  }

  /**
   * POST /auth/register
   * - Registra un usuario final (cliente)
   * - Reutiliza UsersService.create() y fuerza role = 'customer'
   * - Devuelve access_token para que quede logueado al registrarse
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    // 1) Buscar user por email
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      // a) Si NO es invitado -> correo ya ocupado
      if (!existing.isGuest) {
        throw new BadRequestException('Ya existe una cuenta con este correo');
      }

      // b) Es invitado -> lo convertimos en usuario normal
      const upgraded = await this.usersService.upgradeGuest(existing._id.toString(), {
        name: dto.name,
        phone: dto.phone,
        password: dto.password,
      });

      return this.authService.login(upgraded);
    }

    // 2) No existía -> flujo normal
    const user = await this.usersService.create({
      ...dto,
      role: 'customer',
      isGuest: false,
    } as any);

    return this.authService.login(user);
  }


  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    // Lo que te puso la JwtStrategy en el payload:
    const userId = req.user.userId || req.user._id || req.user.id || req.user.sub;

    console.log('[AUTH /me] payload JWT:', req.user);
    console.log('[AUTH /me] userId detectado:', userId);

    if (!userId) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Usa el UsersService real, NO el spec de tests
    const user = await this.usersService.findOne(userId); // ajusta el nombre si tu método se llama distinto

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const plain = (user as any).toObject ? (user as any).toObject() : user;
    delete plain.password;
    delete plain.resetToken;

    console.log('[AUTH /me] usuario retornado:', plain);

    return plain;
  }



  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Request() req) {
    return this.authService.changePassword(
      req.user.userId,
      dto.oldPassword,
      dto.newPassword
    );
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Put('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.newPassword, dto.resetToken);
  }
}
