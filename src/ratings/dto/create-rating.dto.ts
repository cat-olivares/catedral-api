import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @IsMongoId()
  product!: string;

  @IsOptional()
  @IsMongoId()
  reservation?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}
