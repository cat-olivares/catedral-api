import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

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
  async register(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create({
      ...dto,
      role: 'customer' 
    } as any);
    return this.authService.login(user);
  }

  /**
   * GET /auth/me
   * - Ruta protegida con JWT
   * - Devuelve el payload enriquecido del token
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user; // req.user viene de JwtStrategy.validate()
  }

}
