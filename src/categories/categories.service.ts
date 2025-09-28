import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<Category>
  ) {}

  async create(dto: CreateCategoryDto) {
    const category = await this.categoryModel.findOne({ name: dto.name }).exec();
    if (category) {
      throw new BadRequestException('La categoría ya existe');
    }
    const createdCategory = await this.categoryModel.create(dto);
		return createdCategory.save();
  }

  async createMany(dto: CreateCategoryDto[]) {
		return this.categoryModel.create(dto); //agregar varias rows en 1 body
  }

  async findAll() {
    return this.categoryModel.find().exec();
  }

  async findOne(id: string) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    return await this.categoryModel.findByIdAndUpdate({ _id: id }, dto, { new: true }).exec();
  }

  async remove(id: string) {
    return await this.categoryModel.findByIdAndDelete({ _id: id }).exec();
  }
}
