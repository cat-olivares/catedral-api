import { Body, Controller, Post, Get } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { admin } from '../firebase/firebase.init';

// === DTOs simples (se validan con tu ValidationPipe global) ===
class TestReservationPushDto {
  @IsString() reservationId: string;
  @IsString() customerId: string;
  @IsOptional() @IsString() customerName?: string;
}

class TestDirectPushDto {
  @IsString() token: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Dispara la notificación "reserva creada" al ADMIN usando el flujo real:
   * - crea Notification (queued)
   * - busca DeviceTokens del admin
   * - envía por FCM
   * - marca sent/failed
   */
  @Post('test')
  async testReservationPush(@Body() dto: TestReservationPushDto) {
    return this.notificationsService.reservationCreated({
      reservationId: dto.reservationId,
      customerId: dto.customerId,
      customerName: dto.customerName,
    });
  }

  /**
   * Envío directo a UN token (atajo de diagnóstico).
   * No toca DB ni DeviceTokens.
   */
  @Post('test-direct')
  async testDirect(@Body() dto: TestDirectPushDto) {
    const resp = await admin.messaging().send({
      token: dto.token,
      notification: {
        title: 'Test directo 🚀',
        body: 'Hola desde NestJS + Firebase Admin',
      },
    });
    return { ok: true, resp };
  }

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

}
