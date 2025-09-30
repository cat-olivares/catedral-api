import { IsNumber, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateStockDto {
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	quantity: number;
	
	@Type(() => Number)
	@IsNumber()
	@IsOptional()
	@Min(0)
	reserved?: number = 0;  // default 0 si no se envía
}
