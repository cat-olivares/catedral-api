import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  @IsEmail() 
  email: string;

  @IsNotEmpty()
  @Length(13, 13)
  phone: string; // Agregar '+569 ' antes del numero
  
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['admin', 'customer'])
  role: 'admin' | 'customer';
}