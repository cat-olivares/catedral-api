import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateReservationDto, ReservationStatus } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Reservation } from './schemas/reservation.schema';
import { ReservationDetail } from './schemas/reservation-detail.schema';
import { Model, Types } from 'mongoose';
import { Product } from 'src/products/schemas/product.schema';
import { Stock } from 'src/stock/schemas/stock.schema';
import { User } from 'src/users/schemas/user.schema';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ChatsService } from 'src/chats/chats.service';

const reservationPopulate = [
  {
    path: 'user',
    select: 'name email phone'
  },
  {
    path: 'reservationDetail',
    select: 'product quantity subtotal',
    populate: {
      path: 'product',
      select: 'code name price',
      populate: [
        {
          path: 'stock',
          select: 'quantity reserved available'
        },
        {
          path: 'categories',
          select: 'name'
        }
      ]
    }
  }
];

@Injectable()
export class ReservationsService {

  constructor(
    @InjectModel(Reservation.name) private readonly reservationModel: Model<Reservation>,
    @InjectModel(ReservationDetail.name) private readonly reservationDetailModel: Model<ReservationDetail>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Stock.name) private readonly stockModel: Model<Stock>,
    @InjectModel(User.name) private readonly userModel: Model<User>, 
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly chatsService: ChatsService,
    private readonly config: ConfigService,
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
        // leer estado actual para el mensaje
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

    // Crear el chat
    const customerId = new Types.ObjectId(dto.user);
    // console.log("[RES.SRV] ADMIN_USER_ID", this.config.get<string>('ADMIN_USER_ID', '68d9bc388629e807c77810d2')); TO do

    try {
      const chat = await this.chatsService.getOrCreateByPair(
        customerId.toString(),
        this.config.get<string>('ADMIN_USER_ID', '68d9bc388629e807c77810d2')
      );
      console.log("[RES.SRV] chatID", chat._id);

    } catch (e) {
      console.log('No se pudo crear el chat', e);
    }

    // Crear la reserva apuntando a los detalles
    const reservation = await this.reservationModel.create({
      user: customerId,
      status: (dto.status as any) ?? ReservationStatus.PENDING,
      total: computedTotal,
      //chatId: chat._id,
      reservationDetail: detailIds,
    });
    
    // Crear notificación
    try {
      // Obtener datos del cliene (nombre)
      const userDatos = await this.usersService.findByIdWithPassword(customerId.toString());
      const customerRol = userDatos?.role;
      let customerName;
      
      if (customerRol === 'customer') {
        customerName = userDatos?.name;
      } else {
        customerName = "Invitad@";
      }
      await this.notificationsService.reservationCreated({
        reservationId: reservation._id.toString(),
        customerId: customerId.toString(),
        customerName: customerName,
      });
    } catch (e) {
      console.log('No se pudo crear la notificación de reserva', e);
    }

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

  async listByUser(userId: string, status?: ReservationStatus) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('userId inválido');
    }
    const filter: any = { user: new Types.ObjectId(userId) };
    if (status) {
      filter.status = status;
    }
    return this.reservationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate(reservationPopulate)
      .lean()
      .exec();
  }

  async listAll(opts: { status?: ReservationStatus; page: number; limit: number }) {
    const filter: any = {};
    if (opts.status) filter.status = opts.status;

    const [items, total] = await Promise.all([
      this.reservationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((opts.page - 1) * opts.limit)
        .limit(opts.limit)
        .populate(reservationPopulate)
        .lean()
        .exec(),
      this.reservationModel.countDocuments(filter),
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  }

  async findOne(id: string) {
    const reservation = await this.reservationModel
    .findById(id)
    .populate(reservationPopulate)
    .exec()
    if (!reservation) {
      throw new BadRequestException('Reservación no encontrada');
    }
    return reservation;
  }

  /**
   * Modifica la reserva. Si el status cambia a CONFIRMED, se elimina el chat asociado a esta reserva
   * Ajusta stock cuando el status cambia de:
   * * PENDING -> CONFIRMED: resta la cantidad 'reserved' a 'quantity' del stock del producto
   * * PENDING -> CANCELLED: libera stock reservado
   * @param id Id de la reserva a actualizar
   * @param dto Datos de la reserva para actualizar
   * @returns Reservacion actualizada
   */
  async update(id: string, dto: UpdateReservationDto) { // TO DO eliminar chat cuando CONFIRMED o CANCELLED
    // Validar el status
    if (dto.status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(dto.status)) {
      throw new BadRequestException('status inválido');
    }

    // Cargar reserva y sus detalles actuales (ordenados)
    const reservation = await this.reservationModel.findById(id);
    if (!reservation) throw new BadRequestException('Reservación no encontrada');

    const prevStatus = reservation.status;
    const nextStatus = dto.status ?? prevStatus;

    const currentIds = (reservation.reservationDetail ?? []) as any as Types.ObjectId[];
    const currentDetails = currentIds.length
      ? await this.reservationDetailModel
          .find({ _id: { $in: currentIds } })
          .select('_id product quantity subtotal')
          .lean()
      : [];

    // Reordenar según currentIds para preservar índice
    const currentByIndex = currentIds.map(
      oid => currentDetails.find(d => d._id.toString() === oid.toString())!
    );

    // Normalizar DTO entrante
    const incoming = Array.isArray(dto.reservationDetail) ? dto.reservationDetail : null;
    const oldLen = currentByIndex.length;
    const newLen = incoming ? incoming.length : oldLen;
    const overlap = Math.min(oldLen, newLen);

    // Prepara helpers de stock
    const collectProductIds = new Set<string>();
    // productos actuales
    for (const d of currentByIndex) collectProductIds.add(d.product.toString());
    // productos entrantes (si vienen)
    if (incoming) for (const d of incoming) collectProductIds.add(d.product);

    const products = collectProductIds.size
      ? await this.productModel
          .find({ _id: { $in: Array.from(collectProductIds).map(id => new Types.ObjectId(id)) } })
          .select('_id price stock')
          .populate({ path: 'stock', select: 'quantity reserved' })
          .lean()
      : [];

    const prodById = new Map(products.map(p => [p._id.toString(), p]));
    const stockIdOf = (productId: string): Types.ObjectId => {
      const prod: any = prodById.get(productId);
      const stockRef = Array.isArray(prod?.stock) ? prod.stock[0] : prod?.stock;
      const raw = stockRef?._id ?? stockRef;
      if (!raw) throw new BadRequestException(`Producto sin stock asociado: ${productId}`);
      return typeof raw === 'string' ? new Types.ObjectId(raw) : raw;
    };
    const priceOf = (productId: string): number => Number((prodById.get(productId) as any)?.price ?? 0);

    // Diffs de líneas y acumulación de deltas para stock
    type UpdateSame = { id: Types.ObjectId; productId: string; newQty: number; keepSubtotalFromDto: boolean; dtoSubtotal?: number };
    type CreateSpec = { productId: string; qty: number; recompute: boolean };
    const toUpdateSame: UpdateSame[] = [];
    const toCreate: CreateSpec[] = [];
    const toDeleteIds: Types.ObjectId[] = [];

    // deltas de reserved por producto (previo a cambios de estado)
    const reserveIncByProduct = new Map<string, number>(); // +delta
    const reserveDecByProduct = new Map<string, number>(); // +abs(delta)

    const addInc = (pid: string, v: number) => reserveIncByProduct.set(pid, (reserveIncByProduct.get(pid) ?? 0) + v);
    const addDec = (pid: string, v: number) => reserveDecByProduct.set(pid, (reserveDecByProduct.get(pid) ?? 0) + v);

    // posiciones compartidas
    if (incoming) {
      for (let i = 0; i < overlap; i++) {
        const curr = currentByIndex[i];
        const inc = incoming[i];

        if (!inc?.product) throw new BadRequestException(`Falta product en detalle ${i}`);
        if (!Number.isFinite(inc.quantity) || inc.quantity < 1) throw new BadRequestException(`Cantidad inválida en detalle ${i}`);
        if (!Number.isFinite(inc.subtotal) || inc.subtotal < 0) throw new BadRequestException(`Subtotal inválido en detalle ${i}`);

        const currPid = curr.product.toString();
        const newPid = inc.product;

        if (currPid === newPid) {
          const delta = inc.quantity - curr.quantity;
          if (delta === 0) {
            // misma línea, misma qty -> NO recalcula, mantiene subtotal del DTO
            toUpdateSame.push({
              id: curr._id as any,
              productId: currPid,
              newQty: inc.quantity,
              keepSubtotalFromDto: true,
              dtoSubtotal: inc.subtotal,
            });
          } else {
            // qty cambia -> ajustar reserved y RECALCULAR subtotal
            if (delta > 0) addInc(currPid, delta);
            else addDec(currPid, -delta);

            toUpdateSame.push({
              id: curr._id as any,
              productId: currPid,
              newQty: inc.quantity,
              keepSubtotalFromDto: false,
            });
          }
        } else {
          // cambia el producto -> liberar qty vieja, reservar qty nueva, y RECALCULAR
          addDec(currPid, curr.quantity);
          addInc(newPid, inc.quantity);

          // baja
          toDeleteIds.push(curr._id as any);
          // alta
          toCreate.push({ productId: newPid, qty: inc.quantity, recompute: true });
        }
      }
    }

    // altas extra
    if (incoming && newLen > oldLen) {
      for (let i = overlap; i < newLen; i++) {
        const inc = incoming[i];
        if (!inc?.product) throw new BadRequestException(`Falta product en detalle ${i}`);
        if (!Number.isFinite(inc.quantity) || inc.quantity < 1) throw new BadRequestException(`Cantidad inválida en detalle ${i}`);
        // alta -> reservar y RECALCULAR
        addInc(inc.product, inc.quantity);
        toCreate.push({ productId: inc.product, qty: inc.quantity, recompute: true });
      }
    }

    // bajas extra
    if (incoming && newLen < oldLen) {
      for (let i = newLen; i < oldLen; i++) {
        const curr = currentByIndex[i];
        const currPid = curr.product.toString();
        addDec(currPid, curr.quantity);
        toDeleteIds.push(curr._id as any);
      }
    }

    // Aplicar deltas de reserved (primero las liberaciones, luego las reservas)
    // liberar reserved
    for (const [pid, dec] of reserveDecByProduct.entries()) {
      const stockId = stockIdOf(pid);
      const upd = await this.stockModel.updateOne(
        { _id: stockId, reserved: { $gte: dec } },
        { $inc: { reserved: -dec } }
      );
      if (upd.matchedCount !== 1) {
        throw new BadRequestException(`No hay reservado suficiente para revertir producto ${pid}`);
      }
    }
    // reservar (usando $expr con quantity - reserved)
    for (const [pid, inc] of reserveIncByProduct.entries()) {
      const stockId = stockIdOf(pid);
      const upd = await this.stockModel.updateOne(
        { _id: stockId, $expr: { $gte: [ { $subtract: ['$quantity', '$reserved'] }, inc ] } },
        { $inc: { reserved: inc } }
      );
      if (upd.matchedCount !== 1) {
        throw new BadRequestException(`Stock disponible insuficiente para reservar producto ${pid}`);
      }
    }

    // Persistir cambios de detalles
    // a) bajas
    if (toDeleteIds.length) {
      await this.reservationDetailModel.deleteMany({ _id: { $in: toDeleteIds } });
    }

    // b) updates (mismo product; decide si recalcula o respeta subtotal del DTO)
    for (const u of toUpdateSame) {
      const payload: any = {
        product: new Types.ObjectId(u.productId),
        quantity: u.newQty,
      };
      if (u.keepSubtotalFromDto) {
        payload.subtotal = u.dtoSubtotal!;
      } else {
        const price = priceOf(u.productId);
      }
      await this.reservationDetailModel.findByIdAndUpdate(u.id, { $set: payload }, { new: false });
    }

    // c) altas (recalcular)
    let createdDetails: ReservationDetail[] = [];
    if (toCreate.length) {
      const payload = toCreate.map(c => ({
        product: new Types.ObjectId(c.productId),
        quantity: c.qty,
        subtotal: priceOf(c.productId) * c.qty,
      }));
      createdDetails = await this.reservationDetailModel.insertMany(payload);
    } 

    // Construir nuevo array de IDs en el MISMO ORDEN del DTO (por índice)
    const createdQueue = createdDetails.map(d => (d as any)._id as Types.ObjectId);
    const finalDetailIds: Types.ObjectId[] = [];
    if (incoming) {
      // primeras posiciones
      for (let i = 0; i < overlap; i++) {
        const curr = currentByIndex[i];
        const inc = incoming[i];
        if (curr.product.toString() === inc.product) {
          finalDetailIds.push(curr._id as any);
        } else {
          const nid = createdQueue.shift();
          if (!nid) throw new BadRequestException('Inconsistencia creando detalle reemplazado');
          finalDetailIds.push(nid);
        }
      }
      // ids para altas extra
      while (createdQueue.length) finalDetailIds.push(createdQueue.shift()!);
    } else {
      // no vino arreglo -> mantener
      finalDetailIds.push(...currentIds);
    }

    // Recalcular total (suma de subtotales actuales)
    const finalDetails = await this.reservationDetailModel
      .find({ _id: { $in: finalDetailIds } })
      .select('_id subtotal')
      .lean();

    const total = finalDetails.reduce((acc, d) => acc + Number(d.subtotal ?? 0), 0);

    // Si hay cambio de estado, aplicar transición con cantidades FINALES
    if (dto.status && prevStatus !== nextStatus) {
      if (prevStatus === 'PENDING' && (nextStatus === 'CONFIRMED' || nextStatus === 'CANCELLED')) {
        // cargar detalles finales con product/quantity
        const finals = await this.reservationDetailModel
          .find({ _id: { $in: finalDetailIds } })
          .select('product quantity')
          .lean<{ product: Types.ObjectId; quantity: number }[]>();

        // agrupar qty por producto
        const qtyByProduct = new Map<string, number>();
        for (const d of finals) {
          const pid = d.product.toString();
          qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + d.quantity);
        }

        for (const [pid, qty] of qtyByProduct.entries()) {
          const stockId = stockIdOf(pid);

          if (nextStatus === 'CONFIRMED') {
            // mover reservado -> físico
            const upd = await this.stockModel.updateOne(
              { _id: stockId, reserved: { $gte: qty } },
              { $inc: { reserved: -qty, quantity: -qty } }
            );
            if (upd.matchedCount !== 1) {
              throw new BadRequestException(`No hay reservado suficiente para confirmar producto ${pid}`);
            }
            // eliminar chat

          } else if (nextStatus === 'CANCELLED') {
            // liberar reservado
            const upd = await this.stockModel.updateOne(
              { _id: stockId, reserved: { $gte: qty } },
              { $inc: { reserved: -qty } }
            );
            if (upd.matchedCount !== 1) {
              throw new BadRequestException(`No hay reservado suficiente para cancelar producto ${pid}`);
            }
          }
        }
      }
    }

    // 11) Guardar y devolver
    const updateDoc: any = {
      ...(incoming ? { reservationDetail: finalDetailIds } : {}),
      total,
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
   * Se elimina la reserva y revierte el stock segun el status:
   * * PENDING -> libera reservado: reserved -= qty
   * * CONFIRMED -> repone: quantity += qty
   * * CANCELLED -> no se modifica el stock
   * @param id Id de la reserva a eliminar
   * @returns Reserva eliminada
   */
  async remove(id: string) { //TO DO
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