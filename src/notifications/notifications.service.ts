import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as admin from 'firebase-admin';
import { Notification, NotificationDocument, NotificationStatus, NotificationType } from './schemas/notification.schema';
import { DeviceToken } from './schemas/device-token.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly adminUserId = new Types.ObjectId(process.env.ADMIN_USER_ID as string);

  constructor(
    @InjectModel(Notification.name) private readonly notifModel: Model<Notification>,
    @InjectModel(DeviceToken.name) private readonly tokenModel: Model<DeviceToken>,
  ) {}
  
  /**
   * Enviar push al ADMIN cuando se crea una reserva.
   * customerId: usuario que creó la reserva (para abrir el chat con él)
   */
  async reservationCreated(params: { reservationId: string; customerId: string; customerName?: string; }) {
    const { reservationId, customerId, customerName } = params;
    const linkAlChat = `/admin/chat/${customerId}`; // TO DO link web directo al chat ajustar la URL del front

    // 1) Crear registro Notification (queued)
    const doc = new this.notifModel({
      userId: this.adminUserId,
      type: NotificationType.RESERVATION_CREATED,
      title: 'Nueva reserva',
      body: customerName ? `Cliente ${customerName} creó la reserva ${reservationId}` : `Se creó la reserva ${reservationId}`,
      data: {
        target: 'chat',
        customerId,
        reservationId,
        link: linkAlChat, 
      },
      status: NotificationStatus.QUEUED,
    });

    const saved: NotificationDocument = await doc.save();

    // 2) Buscar tokens activos del admin
    const tokens = await this.getActiveTokensForUser(this.adminUserId);
    if (tokens.length === 0) {
      this.logger.warn('No hay device tokens activos para el admin.');
      await this.markAsFailed(saved._id, 'No active tokens for admin');
      return { ok: false, reason: 'no_tokens' };
    }

    // 3) Construir payload FCM con deep-link
    const webAbsoluteLink = this.makeWebAbsoluteLink(linkAlChat);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: saved.title,
        body: saved.body,
      },
      data: {
        // **Datos para manejar navegación en apps móviles/web SW**
        target: 'chat',
        customerId,
        reservationId,
        link: webAbsoluteLink,
        type: NotificationType.RESERVATION_CREATED,
      },
      // Opcional: configura prioridades TO DO
      android: {
        priority: 'high',
        data: {
          target: 'chat',
          customerId,
          reservationId,
          link: webAbsoluteLink,
          type: NotificationType.RESERVATION_CREATED,
        },
        notification: {
          channelId: 'default', // si usas canales
          clickAction: 'FLUTTER_NOTIFICATION_CLICK', // TO DO si usas Flutter; ajusta según tu app
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
      webpush: {
        fcmOptions: {
          link: webAbsoluteLink, // hace click-through directo en Web
        },
      },
    };

    // 4) Enviar
    try {
      const resp = await admin.messaging().sendEachForMulticast(message);
      const success = resp.successCount > 0;

      // Limpieza de tokens inválidos
      await this.deactivateInvalidTokens(tokens, resp);

      if (success) {
        await this.markAsSent(saved._id);
        return { ok: true, sentTo: resp.successCount, failed: resp.failureCount };
      } else {
        const errors = (resp.responses || [])
          .filter(r => !r.success)
          .map(r => r.error?.message || 'unknown error')
          .join(' | ');
        await this.markAsFailed(saved._id, errors);
        return { ok: false, failed: resp.failureCount, errors };
      }
    } catch (err: any) {
      this.logger.error('Error enviando push', err?.message || err);
      await this.markAsFailed(saved._id, err?.message || String(err));
      return { ok: false, error: err?.message || 'send_error' };
    }
  }

  private async getActiveTokensForUser(userId: Types.ObjectId): Promise<string[]> {
    const rows = await this.tokenModel.find({ userId, isActive: true }).lean().exec();
    return rows.map(r => r.token).filter(Boolean);
  }

  private makeWebAbsoluteLink(path: string) {
    const base = process.env.FRONTEND_URL!; //|| 'https://miapp.com';
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  private async markAsSent(id: Types.ObjectId) {
    await this.notifModel.updateOne(
      { _id: id },
      { $set: { status: NotificationStatus.SENT, sentAt: new Date() } },
    ).exec();
  }

  private async markAsFailed(id: Types.ObjectId, errorMessage: string) {
    await this.notifModel.updateOne(
      { _id: id },
      { $set: { status: NotificationStatus.FAILED, errorMessage } },
    ).exec();
  }

  private async deactivateInvalidTokens(tokens: string[], resp: admin.messaging.BatchResponse) {
    const invalidReasons = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ]);
    const toDeactivate: string[] = [];

    resp.responses.forEach((r, i) => {
      if (!r.success && r.error && invalidReasons.has(r.error.code)) {
        toDeactivate.push(tokens[i]);
      }
    });

    if (toDeactivate.length) {
      await this.tokenModel.updateMany(
        { token: { $in: toDeactivate } },
        { $set: { isActive: false, lastSeenAt: new Date() } },
      ).exec();
    }
  }

  findAll() {
    return `This action returns all notifications`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notification`;
  }
}
