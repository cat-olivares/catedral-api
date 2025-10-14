import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateReservationDto, ReservationStatus } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Reservation } from './schemas/reservation.schema';
import { ReservationDetail } from './schemas/reservation-detail.schema';
import { Model, Types } from 'mongoose';
import { Product } from 'src/products/schemas/product.schema';
import { Stock } from 'src/stock/schemas/stock.schema';

@Injectable()
export class ReservationsService {

  constructor(
    @InjectModel(Reservation.name) private readonly reservationModel: Model<Reservation>,
    @InjectModel(ReservationDetail.name) private readonly reservationDetailModel: Model<ReservationDetail>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Stock.name) private readonly stockModel: Model<Stock>,
  ) {}
  
  async create(dto: CreateReservationDto) {
    if (!dto.reservationDetail?.length) {
      throw new HttpException('reservationDetail debe tener al menos 1 ítem', HttpStatus.BAD_REQUEST);
    }

    const productIds = dto.reservationDetail.map(d => new Types.ObjectId(d.product));
    const products = await this.productModel
    .find({ _id: { $in: productIds } })
    .select('_id code name price stock')
    .populate({ path: 'stock', select: 'available reserved quantity' }) 
    .lean();

    const byId = new Map(products.map(p => [p._id.toString(), p]));
    const requiredByProduct = new Map<string, number>();
    
    for (const d of dto.reservationDetail) {
      requiredByProduct.set(d.product, (requiredByProduct.get(d.product) ?? 0) + d.quantity);
    }
    
    // Modificar el stock
    for (const [productId, need] of requiredByProduct.entries()) {
      const producto = byId.get(productId)! as any;

      const stockId = typeof producto.stock[0]._id === 'string' ? new Types.ObjectId(producto.stock[0]._id) : producto.stock[0]._id;

      console.log(producto);
      console.log(stockId);

      const upd = await this.stockModel.updateOne(
        { _id: stockId, $expr: { $gte: [{ $subtract: ['$quantity', '$reserved'] }, Number(need) ]} },
        { $inc: { reserved: Number(need) }}
      );

      if (upd.matchedCount !== 1) {
        // leer estado actual para el mensaje (opcional)
        const curr = await this.stockModel.findById(stockId).select('quantity reserved').lean();
        const availableNow = Math.max(0, Number(curr?.quantity ?? 0) - Number(curr?.reserved ?? 0));
        
        throw new HttpException(
          `Stock insuficiente para ${producto?.name ?? productId}. Requerido ${Number(need)}, disponible ${availableNow}`,
          HttpStatus.BAD_REQUEST
        );
      }
      
      if (upd.modifiedCount !== 1) {
        const available = (producto.stock && typeof producto.stock === 'object') ? producto.stock.available : undefined;
        throw new HttpException(
          `Stock insuficiente para ${producto?.name ?? productId}. Requerido ${need}, disponible ${available ?? 0}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }
    // Recalcular subtotales con price del producto
    const detailsToInsert = dto.reservationDetail.map(detail => {
      const prod = byId.get(detail.product)! as any;
      const unitPrice = Number(prod.price);
      const qty = detail.quantity;

      const computedSubtotal = unitPrice * qty;
      return { product: new Types.ObjectId(detail.product), quantity: qty, subtotal: computedSubtotal };
    });

    // Insertar N ReservationDetail, calcular total y crear Reservation
    const insertedDetails = await this.reservationDetailModel.insertMany(detailsToInsert);
    const detailIds = insertedDetails.map(d => d._id);

    // total = suma de subtotales recalculados
    const computedTotal = insertedDetails.reduce((acc, d) => acc + Number(d.subtotal ?? 0), 0);

    // crear la reserva apuntando a los detalles
    const reservation = await this.reservationModel.create({
      user: new Types.ObjectId(dto.user),
      status: (dto.status as any) ?? ReservationStatus.PENDING,
      total: computedTotal,
      reservationDetail: detailIds,
    });

    // populate para el front
    const populated = await this.reservationModel
      .findById(reservation._id)
      .populate({
        path: 'reservationDetail',
        populate: { path: 'product', select: 'name code price' },
      })
      .lean();

    return populated ?? reservation;
  }

  async findAll() {
    return this.reservationModel.find().exec();
  }

  async findOne(id: string) {
    const reservation = await this.reservationModel
    .findById(id)
    .populate({ path: 'reservationDetail' })
    .exec()
    if (!reservation) {
      throw new BadRequestException('Reservación no encontrada');
    }
    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto) {
    console.log(dto);
    if (dto.status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(dto.status)) {
      throw new BadRequestException('status inválido');
    }
    const reservation = await this.reservationModel.findById(id);
    if (!reservation) {
      throw new BadRequestException('Reservación no encontrada');
    }
    // Eliminar/agregar producto del pedido
    //to do

    // Modificar cantidad/subtotal de producto
    for (let pos = 0; pos < dto.reservationDetail.length; pos++) {
      const id = reservation.reservationDetail[pos];
      const dtoDet = dto.reservationDetail[pos];                                  
      await this.reservationDetailModel.findByIdAndUpdate({ _id: id}, dtoDet, { new: true }).exec();
      //to do
    }
    return await this.reservationModel.findByIdAndUpdate({ _id: id }, dto, { new: true }).exec();
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
