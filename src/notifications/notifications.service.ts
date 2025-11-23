// src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as admin from 'firebase-admin';
import {
  Notification,
  NotificationDocument,
  NotificationStatus,
  NotificationType,
} from './schemas/notification.schema';
import { DeviceToken } from './schemas/device-token.schema';
import {
  MailService,
  ReservationCreatedEmailPayload,
} from 'src/auth/services/mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly adminUserId = new Types.ObjectId(
    process.env.ADMIN_USER_ID as string,
  );

  constructor(
    @InjectModel(Notification.name)
    private readonly notifModel: Model<Notification>,
    @InjectModel(DeviceToken.name)
    private readonly tokenModel: Model<DeviceToken>,
    private readonly mail: MailService,
  ) { }

  /**
   * Enviar notificación cuando se crea una reserva:
   *  - Crea registro Notification
   *  - (Opcional) envía push al admin
   *  - Envía email al cliente
   */
  async reservationCreated(params: {
    reservationId: string;
    customerId: string;
    customerName?: string;
    customerEmail?: string; // <- lo usaremos para el correo
  }) {
    const { reservationId, customerId, customerName, customerEmail } = params;
    const linkAlChat = `/admin/chat/${customerId}`;

    // 1) Crear registro Notification (queued)
    const doc = new this.notifModel({
      userId: this.adminUserId,
      type: NotificationType.RESERVATION_CREATED,
      title: 'Nueva reserva',
      body: customerName
        ? `Cliente ${customerName} creó la reserva ${reservationId}`
        : `Se creó la reserva ${reservationId}`,
      data: {
        target: 'chat',
        customerId,
        reservationId,
        link: linkAlChat,
      },
      status: NotificationStatus.QUEUED,
    });

    const saved: NotificationDocument = await doc.save();

    // 2) ENVIAR EMAIL AL CLIENTE (independiente de los tokens)
    if (customerEmail) {
      const payload: ReservationCreatedEmailPayload = {
        to: customerEmail,
        reservationId,
        customerName,
      };

      try {
        await this.mail.sendReservationCreatedEmail(payload);
        this.logger.log(
          `[Notifications] Email de reserva enviado a ${customerEmail}`,
        );
      } catch (err: any) {
        this.logger.error(
          '[Notifications] Error enviando email de reserva',
          err?.message || err,
        );
      }
    } else {
      this.logger.warn(
        `[Notifications] No se envió email de reserva: cliente sin email (customerId=${customerId})`,
      );
    }

    // 3) PUSH al admin (si hay tokens) – si no hay, NO cortamos el flujo del mail
    const tokens = await this.getActiveTokensForUser(this.adminUserId);
    if (tokens.length === 0) {
      this.logger.warn('No hay device tokens activos para el admin.');
      await this.markAsFailed(saved._id, 'No active tokens for admin');
      return { ok: false, reason: 'no_tokens' };
    }

    const webAbsoluteLink = this.makeWebAbsoluteLink(linkAlChat);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: saved.title,
        body: saved.body,
      },
      data: {
        target: 'chat',
        customerId,
        reservationId,
        link: webAbsoluteLink,
        type: NotificationType.RESERVATION_CREATED,
      },
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
          channelId: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: { sound: 'default' },
        },
      },
      webpush: {
        fcmOptions: { link: webAbsoluteLink },
      },
    };

    try {
      const resp = await admin.messaging().sendEachForMulticast(message);
      const success = resp.successCount > 0;

      await this.deactivateInvalidTokens(tokens, resp);

      if (success) {
        await this.markAsSent(saved._id);
        return {
          ok: true,
          sentTo: resp.successCount,
          failed: resp.failureCount,
        };
      } else {
        const errors = (resp.responses || [])
          .filter((r) => !r.success)
          .map((r) => r.error?.message || 'unknown error')
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

  private async getActiveTokensForUser(
    userId: Types.ObjectId,
  ): Promise<string[]> {
    const rows = await this.tokenModel
      .find({ userId, isActive: true })
      .lean()
      .exec();
    return rows.map((r) => r.token).filter(Boolean);
  }

  private makeWebAbsoluteLink(path: string) {
    const base = process.env.FRONTEND_URL!;
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  private async markAsSent(id: Types.ObjectId) {
    await this.notifModel
      .updateOne(
        { _id: id },
        { $set: { status: NotificationStatus.SENT, sentAt: new Date() } },
      )
      .exec();
  }

  private async markAsFailed(id: Types.ObjectId, errorMessage: string) {
    await this.notifModel
      .updateOne(
        { _id: id },
        { $set: { status: NotificationStatus.FAILED, errorMessage } },
      )
      .exec();
  }

  private async deactivateInvalidTokens(
    tokens: string[],
    resp: admin.messaging.BatchResponse,
  ) {
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
      await this.tokenModel
        .updateMany(
          { token: { $in: toDeactivate } },
          { $set: { isActive: false, lastSeenAt: new Date() } },
        )
        .exec();
    }
  }

  // (resto de métodos dummy, si los usas)
  findAll() {
    return `This action returns all notifications`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notification`;
  }
}
