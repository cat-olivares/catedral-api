// src/auth/services/mail.service.ts
import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ReservationCreatedEmailPayload {
  to: string;
  reservationId: string;
  customerName?: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('MAIL_PORT', 465),
      secure: true, 
      auth: {
        user: this.config.get<string>('MAIL_USER', 'catedralperfumes@gmail.com'),
        pass: this.config.get<string>('MAIL_PASS'), 
      },
    });
  }

  async sendResetPassEmail(to: string, token: string) {
    const resetlink = `${
      this.config.get<string>('FRONTEND_URL', 'https://perfumescatedral.vercel.app')
    }/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from:
        this.config.get<string>(
          'MAIL_FROM',
          `"Soporte Perfumes Catedral" <catedralperfumes@gmail.com>`,
        ),
      to,
      subject: 'Restablecer contraseña',
      html: `
        <p>Para restablecer tu contraseña, 
           <a href="${resetlink}">haz click aquí</a>.
        </p>
        <p>Si no solicitaste un cambio de contraseña, ignora este correo.</p>
      `,
    });
  }

  async sendReservationCreatedEmail(payload: ReservationCreatedEmailPayload) {
    const { to, reservationId, customerName } = payload;

    const baseUrl = this.config.get<string>(
      'FRONTEND_URL',
      'https://perfumescatedral.vercel.app',
    );

    const reservationLink = `${baseUrl.replace(/\/+$/, '')}/profile/reservations`;
    const safeName = customerName || 'cliente';

    await this.transporter.sendMail({
      from:
        this.config.get<string>(
          'MAIL_FROM',
          `"Perfumes Catedral" <catedralperfumes@gmail.com>`,
        ),
      to,
      subject: 'Hemos recibido tu reserva',
      html: `
        <p>Hola ${safeName},</p>
        <p>Hemos recibido tu reserva <strong>#${reservationId}</strong>.</p>
        <p>En breve nos pondremos en contacto contigo para coordinar el pedido.</p>
        <p>Puedes revisar tus reservas ingresando aquí:
          <a href="${reservationLink}">${reservationLink}</a>
        </p>
        <p>Gracias por comprar en Perfumes Catedral 💜</p>
      `,
    });
  }
}
