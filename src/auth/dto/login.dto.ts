import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  phone: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword: string;  
  
  @IsString()
  @MinLength(6)
  newPassword: string;  
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

