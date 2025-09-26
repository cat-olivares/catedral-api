import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
		@InjectModel(User.name) 
		private userModel: Model<User>
	) {}
  
  async create(dto: CreateUserDto): Promise<User> {
		const emailExists = await this.userModel.exists({ email: dto.email.toLowerCase() });
		if (emailExists) {
			console.log('Email ya registrado');
			throw new BadRequestException('Email ya registrado');
		}
		const createdUser = new this.userModel(dto);
		await createdUser.save();
		return createdUser;
  }

  async findAll(): Promise<User[]> {
		return this.userModel.find().exec();
  }

  async findByIdWithPassword(id: string) {
		return await this.userModel.findById(id).select('+password');
  }

	async findByEmail(email: string) {
		return await this.userModel.findOne({ email: email.toLowerCase() });
	}

	async findByEmailWithPassword(email: string) {
		return this.userModel.findOne({ email: email.toLowerCase() }).select('+password');
  }

  async update(id: any, dto: UpdateUserDto) {
		return await this.userModel.findByIdAndUpdate(
      { _id: id }, 
      dto, 
      { 
        new: true,            // devuelve el doc actualizado
        runValidators: true,  // aplica validaciones del schema en updates
        context: 'query',     // necesario para algunos validators
      }
    ).exec();
	}


	async delete(id: string) {
		return await this.userModel.findByIdAndDelete({ _id: id }).exec();
	}


}
