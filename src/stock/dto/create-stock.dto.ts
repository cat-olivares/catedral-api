import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, Min } from "class-validator";

export class CreateStockDto {
	@IsNumber()
	@Min(0)
	quantity: number;
	
	@IsNumber()
	@Min(0)
	@IsOptional()
	reserved?: number = 0;  // default 0 si no se envía
}
