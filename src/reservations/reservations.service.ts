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

  /**
   * No recalcula nada: toma quantity, subtotal y total tal cual vienen en el DTO.
   * Ajusta stock solo cuando el status cambia de:
   * * PENDING -> CONFIRMED: resta la cantidad 'reserved' a 'quantity' del dtock del producto
   * * PENDING -> CANCELLED: libera stock reservado
   * @param id Id de la reserva a actualizar
   * @param dto Datos de la reserva para actualizar
   * @returns Reservacion actualizada
   */
  async update(id: string, dto: UpdateReservationDto) {
    if (dto.status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(dto.status)) {
      throw new BadRequestException('status inválido');
    }
    const reservation = await this.reservationModel.findById(id);
    if (!reservation) {
      throw new BadRequestException('Reservación no encontrada');
    }

    const prevStatus = reservation.status;
    const nextStatus = dto.status ?? prevStatus;

    // Si no viene reservationDetail en el DTO, sólo actualizar campos simples
    const incomingDetails = Array.isArray(dto.reservationDetail) ? dto.reservationDetail : null;

    // IDs actuales (en orden actual)
    const currentIds = (reservation.reservationDetail ?? []) as any as Types.ObjectId[];
    const oldLen = currentIds.length;
    const newLen = incomingDetails ? incomingDetails.length : oldLen;
    const overlap = Math.min(oldLen, newLen);

    // Modificar detalle de los productos (0..overlap-1)
    if (incomingDetails) {
      for (let i = 0; i < overlap; i++) {
        const detailId = currentIds[i];
        const payload = incomingDetails[i];

        // Validar datos
        if (!payload?.product) throw new BadRequestException(`Falta product en detalle ${i}`);
        if (!Number.isFinite(payload.quantity) || payload.quantity < 1) {
          throw new BadRequestException(`Cantidad inválida en detalle ${i}`);
        }
        if (!Number.isFinite(payload.subtotal) || payload.subtotal < 0) {
          throw new BadRequestException(`Subtotal inválido en detalle ${i}`);
        }

        await this.reservationDetailModel.findByIdAndUpdate(
          detailId,
          {
            $set: {
              product: new Types.ObjectId(payload.product),
              quantity: payload.quantity,
              subtotal: payload.subtotal,
            },
          },
          { new: false }
        );
      }
    }

    // Agregar nuevo(s) detalle(s) (overlap..newLen-1)
    let createdIds: Types.ObjectId[] = [];
    if (incomingDetails && newLen > oldLen) {
      const toCreate = incomingDetails.slice(overlap).map((d, idx) => {
        if (!d?.product) throw new BadRequestException(`Falta product en detalle ${overlap + idx}`);
        if (!Number.isFinite(d.quantity) || d.quantity < 1) {
          throw new BadRequestException(`Cantidad inválida en detalle ${overlap + idx}`);
        }
        if (!Number.isFinite(d.subtotal) || d.subtotal < 0) {
          throw new BadRequestException(`Subtotal inválido en detalle ${overlap + idx}`);
        }
        return {
          product: new Types.ObjectId(d.product),
          quantity: d.quantity,
          subtotal: d.subtotal, 
        };
      });

      const inserted = await this.reservationDetailModel.insertMany(toCreate);
      createdIds = inserted.map(d => (d as any)._id as Types.ObjectId);
    }

    // Eliminar detalle(s) (newLen..oldLen-1)
    if (incomingDetails && newLen < oldLen) {
      const toDeleteIds = currentIds.slice(newLen);
      if (toDeleteIds.length) {
        await this.reservationDetailModel.deleteMany({ _id: { $in: toDeleteIds } });
      }
    }

    // Construir array de IDs de detalles para updatear la reserva 
    let finalDetailIds: Types.ObjectId[];
    if (incomingDetails) {
      finalDetailIds = [
        ...currentIds.slice(0, overlap),
        ...createdIds,
      ];
    } else {
      // si no vino reservationDetail, se mantienen los IDs actuales
      finalDetailIds = currentIds;
    }

    // Si cambia el status, aplicar efectos de stock según transición
    if (dto.status && nextStatus !== prevStatus) {
      // Traer detalles finales (los que quedarán en la reserva)
      const finalDetails = await this.reservationDetailModel
        .find({ _id: { $in: finalDetailIds } })
        .select('_id product quantity')
        .lean<{ _id: Types.ObjectId; product: Types.ObjectId; quantity: number }[]>();

      // Agrupar quantity por producto
      const requiredByProduct = new Map<string, number>();
      for (const d of finalDetails) {
        const pid = d.product.toString();
        requiredByProduct.set(pid, (requiredByProduct.get(pid) ?? 0) + Number(d.quantity ?? 0));
      }

      // Cargar productos con su stock (para conocer stockId)
      const productDocs = await this.productModel
        .find({ _id: { $in: Array.from(requiredByProduct.keys()).map(id => new Types.ObjectId(id)) } })
        .select('_id stock')
        .populate({ path: 'stock', select: 'quantity reserved' })
        .lean();

      const prodById = new Map(productDocs.map(p => [p._id.toString(), p]));

      // Transiciones de stock
      for (const [productId, qty] of requiredByProduct.entries()) {
        const prod: any = prodById.get(productId);
        const stockRef = Array.isArray(prod?.stock) ? prod.stock[0] : prod?.stock;
        const stockId = typeof stockRef?._id === 'string' ? new Types.ObjectId(stockRef._id) : stockRef?._id;
        if (!stockId) throw new BadRequestException(`Producto sin stock asociado: ${productId}`);

        // PENDING -> CONFIRMED: restar reservado
        if (prevStatus === 'PENDING' && nextStatus === 'CONFIRMED') {
          const upd = await this.stockModel.updateOne(
            { _id: stockId, reserved: { $gte: qty } },
            { $inc: { reserved: -qty, quantity: -qty } }
          );
          if (upd.matchedCount !== 1) {
            throw new BadRequestException(`No hay reservado suficiente para confirmar producto ${productId}`);
          }
        }

        // PENDING -> CANCELLED: liberar lo reservado
        if (prevStatus === 'PENDING' && nextStatus === 'CANCELLED') {
          const upd = await this.stockModel.updateOne(
            { _id: stockId, reserved: { $gte: qty } },
            { $inc: { reserved: -qty } }
          );
          if (upd.matchedCount !== 1) {
            throw new BadRequestException(`No hay reservado suficiente para cancelar producto ${productId}`);
          }
        }
      }
    }

    // Armar el update de la Reserva
    const updateDoc: any = {
      ...(incomingDetails ? { reservationDetail: finalDetailIds } : {}),
      ...(dto.total !== undefined ? { total: dto.total } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.user ? { user: new Types.ObjectId(dto.user) } : {}),
    };

    const updated = await this.reservationModel
      .findByIdAndUpdate(id, { $set: updateDoc }, { new: true })
      .populate({
        path: 'reservationDetail',
        populate: { path: 'product', select: 'name code price' },
      })
      .lean();

    return updated;
  }

  /**
   * Se revierte el stock segun el status:
   * * PENDING -> libera reservado: reserved -= qty
   * * CONFIRMED -> repone: quantity += qty
   * * CANCELLED -> no se modifica el stock
   * @param id Id de la reserva a eliminar
   * @returns Reserva eliminada
   */
  async remove(id: string) {
    const reservation = await this.reservationModel.findById(id).lean();
    if (!reservation) throw new BadRequestException('Reservación no encontrada');

    const detailIds = (reservation.reservationDetail ?? []) as any[];
    if (!detailIds.length) {
      return await this.reservationModel.findByIdAndDelete(id).exec();
    }

    // Traer detalles con product y quantity
    const details = await this.reservationDetailModel
      .find({ _id: { $in: detailIds } })
      .select('_id product quantity')
      .lean<{ _id: Types.ObjectId; product: Types.ObjectId; quantity: number }[]>();

    // Agrupar qty por producto
    const qtyByProduct = new Map<string, number>();
    for (const d of details) {
      const pid = d.product.toString();
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + Number(d.quantity ?? 0));
    }

    // Si la reserva está CANCELLED, no se toca el stock
    if (reservation.status !== 'CANCELLED') {
      // Cargar productos con su stock
      const productDocs = await this.productModel
        .find({ _id: { $in: Array.from(qtyByProduct.keys()).map(id => new Types.ObjectId(id)) } })
        .select('_id stock')
        .populate({ path: 'stock', select: 'quantity reserved' })
        .lean();

      const prodById = new Map(productDocs.map(p => [p._id.toString(), p]));

      for (const [productId, qty] of qtyByProduct.entries()) {
        const prod: any = prodById.get(productId);
        const stockRef = Array.isArray(prod?.stock) ? prod.stock[0] : prod?.stock;
        const stockId = typeof stockRef?._id === 'string' ? new Types.ObjectId(stockRef._id) : stockRef?._id;
        if (!stockId) throw new BadRequestException(`Producto sin stock asociado: ${productId}`);

        if (reservation.status === 'PENDING') {
          // Liberar reservado
          const upd = await this.stockModel.updateOne(
            { _id: stockId, reserved: { $gte: qty } },
            { $inc: { reserved: -qty } }
          );
          if (upd.matchedCount !== 1) {
            throw new BadRequestException(`No hay reservado suficiente para revertir producto ${productId}`);
          }
        } else if (reservation.status === 'CONFIRMED') {
          // Reponer stock
          const upd = await this.stockModel.updateOne(
            { _id: stockId },
            { $inc: { quantity: +qty } }
          );
          if (upd.matchedCount !== 1) {
            throw new BadRequestException(`No se pudo reponer stock de producto ${productId}`);
          }
        }
      }
    }
    // Borrar detalles y la reserva
    await this.reservationDetailModel.deleteMany({ _id: { $in: detailIds } });
    return await this.reservationModel.findByIdAndDelete(id).exec();
  }

}
