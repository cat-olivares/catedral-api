import { IsMongoId } from 'class-validator';

export class CreateChatDto {
  // chat por par: cliente–admin
  @IsMongoId()
  clienteId!: string;

  @IsMongoId()
  adminId!: string;
}

export class ReadChatDto {
  // quien marca como leído (el que abrió el chat)
  @IsMongoId()
  readerUserId!: string;
}