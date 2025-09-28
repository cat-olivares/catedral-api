import { Controller, Get, Post, Body, Patch, Param, Delete, Query, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Types } from 'mongoose';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('many')
  async createMany(@Body() createProductDtos: CreateProductDto[]) {
    return this.productsService.createMany(createProductDtos);
  }

  @Get()
  async findByCategories(@Query('categories') categories?: string) {
    if (!categories) {
      return this.productsService.findAll(); 
    }
    // Normalizar ids (separar, quitar vacíos y duplicados)
    const ids = Array.from(
      new Set(categories.split(',').map((s) => s.trim()).filter(Boolean))
    );
    if (ids.length === 0) {
      throw new BadRequestException('Parámetro "categories" vacío');
    }
    // Validar los ids ObjectId
    const objectIds = ids.map((id) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`ID de categoría inválido: ${id}`);
      }
      return new Types.ObjectId(id);
    });
    const filter = { categories: { $all: objectIds } };
    return this.productsService.findByCategories(filter);
  } // GET /products?categories=68d89d6c...

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
