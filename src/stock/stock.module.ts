import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Stock, StockSchema } from './schemas/stock.schema';

@Module({
  controllers: [StockController],
  providers: [StockService],
  imports: [
    MongooseModule.forFeature([{ name: Stock.name, schema: StockSchema }])
  ],
  exports: [StockService],
})
export class StockModule {}
