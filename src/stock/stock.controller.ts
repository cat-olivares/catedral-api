import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  async create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @Get()
  async findAll() {
    return this.stockService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(id, updateStockDto);
  }

  @Post(':id/add')
  async addQuantity(
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount debe ser un número mayor que 0');
    }

    return this.stockService.increaseQuantity(id, amount);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}
