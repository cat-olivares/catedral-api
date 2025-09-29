import { Injectable } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Stock } from './schemas/stock.schema';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Stock.name) 
    private stockModel: Model<Stock>
  ) {}

  async create(dto: CreateStockDto) {
    const createdStock = await this.stockModel.create(dto);
    return createdStock.save();
  }

  async findAll() {
    return this.stockModel.find().exec();
  }

  async findOne(id: string) {
    return this.stockModel.findById(id).exec();
  }

  async update(id: string, updateStockDto: UpdateStockDto) {
    return this.stockModel.findByIdAndUpdate({ _id: id }, updateStockDto, { new: true }).exec();
  }

  async remove(id: string) {
    return this.stockModel.findByIdAndDelete({ _id: id }).exec();
  }
}
