import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
	@IsString()
	@IsNotEmpty()
	@Transform(({ value }) =>
	typeof value === 'string' ? value.trim().toLowerCase() : value
	)
	name: string;

	@IsOptional()
	@IsString()
	description?: string;
}