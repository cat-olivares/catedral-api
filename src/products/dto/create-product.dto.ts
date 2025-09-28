import { IsArray, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  categories?: string[]; // array de ObjectId de categorías

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  img_url?: string;

  /*
  @IsMongoId({ each: true })
  stock: string; // ObjectId

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  valorations?: string[]; // array de ObjectId de categorías
*/
}
