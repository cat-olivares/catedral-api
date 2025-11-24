import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsService } from './rating.service';
import { RatingsController } from './rating.controller';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { Product, ProductSchema } from 'src/products/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rating.name, schema: RatingSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
