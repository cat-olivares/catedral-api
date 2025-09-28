import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private productModel: Model<Product>
  ) {}

  async create(dto: CreateProductDto) {
    const codeExists = await this.productModel.exists({ code: dto.code });
    if (codeExists) {
      throw new BadRequestException('Código ya existe');
    }
    const createdProduct = await this.productModel.create(dto);
    return createdProduct.save();
  }

  async createMany(dto: CreateProductDto[]) {
    return this.productModel.create(dto);
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().exec();
  }

  async findByCategories(filter: any) {
    return this.productModel.find(filter).lean().exec();
  }

  async findOne(id: string) {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new BadRequestException('Producto no encontrado');
    }
    console.log(product.categories);

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    return await this.productModel.findByIdAndUpdate({ _id: id }, dto, { new: true }).exec();
  }

  async remove(id: string) {
    return await this.productModel.findByIdAndDelete({ _id: id }).exec();
  }
}
