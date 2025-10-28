import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { QueryNotificationsDto } from './dto/query-notification.dto';
import { Notification } from './schemas/notification.schema';

type Paginated<T> = { data: T[]; page: number; per_page: number; total_count: number };

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) 
    private readonly notificationModel: Model<Notification>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = await this.notificationModel.create({
      ...createNotificationDto,
      isRead: false,
      isDeleted: false,
    });
    return notification.toObject();
  }


  async findAll(query: QueryNotificationsDto): Promise<Paginated<Notification>> {
    const {
      userId,
      type,
      unreadOnly,
      fromDate,
      toDate,
      page = '1',
      per_page = '20',
    } = query;

    const conditions: FilterQuery<Notification> = { isDeleted: false };

    if (userId) {
      conditions.userId = new Types.ObjectId(userId);
    }
    if (type) {
      conditions.type = type;
    }
    if (unreadOnly === 'true') {
      conditions.isRead = false;
    }
    if (fromDate || toDate) {
      conditions.createdAt = {};
      if (fromDate) conditions.createdAt.$gte = new Date(fromDate);
      if (toDate) conditions.createdAt.$lte = new Date(toDate);
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(per_page), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limit;

    const [data, total_count]: [Notification[], number] = await Promise.all([
      this.notificationModel
        .find(conditions)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<Notification[]>()
        .exec(),
      this.notificationModel.countDocuments(conditions).exec(),
    ]);

    return {
      data,
      page: pageNum,
      per_page: limit,
      total_count,
    };
  }

  async findOne(id: string): Promise<Notification> {
    const doc = await this.notificationModel.findOne({ _id: id, isDeleted: false }).lean().exec();
    if (!doc) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return doc;
  }

  async update(id: string, payload: UpdateNotificationDto): Promise<Notification> {
    const update: any = { ...payload };

    // Si se marca como leída y no trae readAt, se setea ahora
    if (payload.isRead === true && !payload.readAt) {
      update.readAt = new Date();
    }
    // Si se marca como no leída, limpiar readAt
    if (payload.isRead === false) {
      update.readAt = null;
    }

    const doc = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: update },
        { new: true, lean: true },
      )
      .exec();

    if (!doc) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return doc;
  }

  async markAsRead(id: string): Promise<Notification> {
    const doc = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true, lean: true },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return doc;
  }

  // Soft delete
  async remove(id: string): Promise<{ deleted: boolean }> {
    const res = await this.notificationModel.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
    if (!res.matchedCount) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return { deleted: true };
  }

  // eliminar definitivamente
  async purge(id: string): Promise<{ purged: boolean }> {
    const res = await this.notificationModel.deleteOne({ _id: id });
    if (!res.deletedCount) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return { purged: true };
  }

}
