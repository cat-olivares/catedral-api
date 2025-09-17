import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId  } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  
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

  /**Busca por id, email o name  
	 * POST {url}/users/{id} || {email} || {name}
	 * @param param String (id, email o name)
	 * @returns User
	 * @throws statusCode: 404 si el string no es encontrado
	 * @example
	 * { "message": "Usuario no encontrado",
			 "error": "Not Found",
				"statusCode": 404 }
	*/
	async findOne(param: string): Promise<User> {
		let user: User | null = null;
		if (isValidObjectId(param)) {
			user = await this.userModel.findById(param).exec();
		} else if (param.includes('@')) {
			user = await this.userModel.findOne({ email: param }).exec();
		} else {
			user = await this.userModel.findOne({ name: param }).exec();
		}
		if (!user) {
			throw new NotFoundException('Usuario no encontrado');
		}
		return user;
	}

  
  async update(id: string, dto: UpdateUserDto) {
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


  async findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password');
  }
}
