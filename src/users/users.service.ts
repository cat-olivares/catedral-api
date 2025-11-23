import { BadRequestException, Injectable } from '@nestjs/common';
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
	) { }

	async create(dto: CreateUserDto): Promise<User> {
		const emailExists = await this.userModel.exists({ email: dto.email.toLowerCase() });
		if (emailExists) {
			throw new BadRequestException('Email ya registrado');
		}
		const createdUser = new this.userModel(dto);
		await createdUser.save();
		return createdUser;
	}

	async findOne(id: string) {
		return this.userModel
			.findById(id)
			.select('-password -__v')
			.lean()
			.exec();
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

	  async createGuest(data: { email: string; name?: string; phone?: string }): Promise<User> {
    const email = data.email.toLowerCase();

    // Si ya existe un usuario con ese correo, lo reutilizamos (sea guest o normal)
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      return existing;
    }

    // Creamos usuario invitado
    const guest = new this.userModel({
      name: data.name || 'Invitado',
      email,
      phone: data.phone || '',
      role: 'customer',
      isGuest: true,
      // password random solo para cumplir el required, se hashea en los hooks
      password: Math.random().toString(36).slice(2),
    });

    await guest.save();
    return guest;
  }


	async upgradeGuest(id: string, payload: { name: string; phone: string; password: string }): Promise<User> {
		// Gracias a los hooks del schema, el password se va a hashear en findOneAndUpdate
		const updated = await this.userModel.findByIdAndUpdate(
			{ _id: id },
			{
				name: payload.name,
				phone: payload.phone,
				password: payload.password,
				isGuest: false,
			},
			{
				new: true,
				runValidators: true,
				context: 'query',
			}
		).exec();

		if (!updated) {
			throw new BadRequestException('Usuario no encontrado');
		}

		return updated;
	}



}
