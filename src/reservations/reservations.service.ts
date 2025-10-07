import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateReservationDto, ReservationStatus } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Reservation } from './schemas/reservation.schema';
import { ReservationDetail } from './schemas/reservation-detail.schema';
import { Model, Types } from 'mongoose';
import { Product } from 'src/products/schemas/product.schema';

@Injectable()
export class ReservationsService {

  constructor(
    @InjectModel(Reservation.name) private readonly reservationModel: Model<Reservation>,
    @InjectModel(ReservationDetail.name) private readonly reservationDetailModel: Model<ReservationDetail>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}
  
  async create(dto: CreateReservationDto) {
    if (!dto.reservationDetail?.length) {
      throw new HttpException('reservationDetail debe tener al menos 1 ítem', HttpStatus.BAD_REQUEST);
    }
    const status: ReservationStatus = (dto.status as any) ?? ReservationStatus.PENDING;

    const productIds = dto.reservationDetail.map(d => new Types.ObjectId(d.product));

    const products = await this.productModel
    .find({ _id: { $in: productIds } })
    .select('_id price name code')
    .lean()
    .exec()

    const byId = new Map(products.map(p => [p._id.toString(), p]));

    // Verificar que los productos tengan stock
    const requiredByProduct = new Map<string, number>();

    for (const d of dto.reservationDetail) {
      requiredByProduct.set(d.product, (requiredByProduct.get(d.product) ?? 0) + d.quantity);
    }
    
    console.log(requiredByProduct);

    // 1) Intentar reservar stock por producto (atómico)
    /*
    for (const [productId, need] of requiredByProduct.entries()) {
      const upd = await this.productModel.updateOne(
        { _id: productId, quantity: { $gte: need } },        // condición: hay stock suficiente
        { $inc: { quantity: -need, reserved: need } },       // mover de disponible→reservado
        { session }
      );

      if (upd.modifiedCount !== 1) {
        const p = byId.get(productId);
        throw new HttpException(
          `Stock insuficiente para ${p?.name ?? productId}. Requerido ${need}.`,
          HttpStatus.BAD_REQUEST
        );  
      }
    }
    */
    // Calcular subtotales
  return 'This action adds a new reservation';
}

  async findAll() {
    return this.reservationModel.find().exec();
  }

  async findOne(id: string) {
    const reservation = await this.reservationModel
    .findById(id)
    //.populate({path: 'reservationDetails'})
    .exec()
    if (!reservation) {
      throw new BadRequestException('Reservación no encontrada');
    }
    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto) {
    return await this.reservationModel.findByIdAndUpdate({_id: id}, dto, { new: true }).exec();
  }

  async remove(id: string) {
    const res = await this.reservationModel.findById(id).exec();
    if (!res) {
      throw new BadRequestException('Reservación no encontrada');
    }
    const resDetId = res.reservationDetail;
    await this.reservationDetailModel.findByIdAndDelete({ _id: resDetId }).exec();
    return await this.reservationModel.findByIdAndDelete({ _id: id }).exec();
  }
}
