import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Stock, StockSchema } from './schemas/stock.schema';

@Module({
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
  imports: [
    MongooseModule.forFeature([
      { name: Stock.name, schema: StockSchema },
    ])
  ],
})
export class StockModule {}
