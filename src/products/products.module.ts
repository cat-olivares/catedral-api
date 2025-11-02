import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { Category, CategorySchema } from 'src/categories/schemas/category.schema';
import { Stock, StockSchema } from 'src/stock/schemas/stock.schema';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Stock.name, schema: StockSchema },
    ])
  ],
})
export class ProductsModule {}
