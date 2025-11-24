import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rating } from './schemas/rating.schema';
import { Product } from 'src/products/schemas/product.schema';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectModel(Rating.name) private readonly ratingModel: Model<Rating>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async rate(userId: string, dto: CreateRatingDto) {
    this.logger.log('[RatingsService] rate() called ' + JSON.stringify({ userId, dto }));

    const user = new Types.ObjectId(userId);
    const productId = new Types.ObjectId(dto.product);

    // 1) upsert rating de este user para este producto
    const existing = await this.ratingModel.findOne({ user, product: productId }).exec();

    if (existing) {
      this.logger.log(`[RatingsService] updating rating existing=${existing.value} -> ${dto.value}`);
      existing.value = dto.value;
      existing.reservation = dto.reservation ? new Types.ObjectId(dto.reservation) : existing.reservation;
      await existing.save();
    } else {
      this.logger.log('[RatingsService] creating new rating');
      await this.ratingModel.create({
        user,
        product: productId,
        reservation: dto.reservation ? new Types.ObjectId(dto.reservation) : undefined,
        value: dto.value,
      });
    }

    // 2) recalcular promedio y count
    const agg = await this.ratingModel.aggregate([
      { $match: { product: productId } },
      {
        $group: {
          _id: '$product',
          avg: { $avg: '$value' },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = agg[0];
    if (!stats) {
      throw new BadRequestException('No se pudieron calcular las estadísticas de rating');
    }

    this.logger.log('[RatingsService] new stats: ' + JSON.stringify(stats));

    const updatedProduct = await this.productModel.findByIdAndUpdate(
      productId,
      {
        $set: {
          rating: Number(stats.avg.toFixed(2)),
          ratingCount: stats.count,
        },
      },
      { new: true },
    ).lean();

    this.logger.log('[RatingsService] product updated rating=' + updatedProduct?.rating);

    return {
      ok: true,
      productId: dto.product,
      rating: updatedProduct?.rating,
      ratingCount: updatedProduct?.ratingCount,
    };
  }
}
