import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { Category } from 'src/categories/schemas/category.schema';
import { Stock } from 'src/stock/schemas/stock.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(Stock.name) private readonly stockModel: Model<Stock>,
  ) {}

  async create(dto: CreateProductDto) {
    const codeExists = await this.productModel.exists({ code: dto.code });
    if (codeExists) {
      throw new BadRequestException('Código ya existe');
    }
    // Crear stock;
    const stock = await this.stockModel.create({ 
      quantity: dto.initialQuantity ?? 0, 
      reserved: 0,
    });
    console.log('Stock creado:', stock);

    // Crear producto
    try {
      const categories: Types.ObjectId[] =
      (dto.categories ?? []).map(id => new Types.ObjectId(id));

      const product = await this.productModel.create({
        code: dto.code,
        name: dto.name,
        categories: categories,
        price: dto.price,
        img_url: dto.img_url,
        stock: stock._id,
      });

      console.log('Producto creado:', product);

      return this.productModel
      .findById(product._id)
      .populate('stock')
      .lean()
      .exec();

    } catch (error) {
      // Si hay error, eliminar el stock
      await this.stockModel.deleteOne({ _id: stock._id });
      throw error;
    }
  }

  async createMany(dto: CreateProductDto[]) {
    return this.productModel.create(dto);
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().exec();
  }

  async findOne(id: string) {
    const product = await this.productModel
    .findById(id)
    .populate({ path: 'categories', select: 'name' })
    .populate({ path: 'stock' }) 
    .exec();
    if (!product) {
      throw new BadRequestException('Producto no encontrado');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    return await this.productModel.findByIdAndUpdate({ _id: id }, dto, { new: true }).exec();
  }

  async remove(id: string) {
    // eliminar el stock asociado 
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new BadRequestException('Producto no encontrado');
    }
    const stockId = product.stock;
    await this.stockModel.findByIdAndDelete({ _id: stockId }).exec();
    return await this.productModel.findByIdAndDelete({ _id: id }).exec();
  }
}
