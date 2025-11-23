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
      host: this.config.get<string>('MAIL_HOST', 'smtp.ethereal.email'),
      port: this.config.get<number>('MAIL_PORT', 587),
      auth: {
        user: this.config.get<string>('MAIL_USER', 'thelma84@ethereal.email'),
        pass: this.config.get<string>('MAIL_PASS', 'm5qHPHnwvzUjptRkcx'),
      },
    });
  }

  async sendResetPassEmail(to: string, token: string) {
    const resetlink = `${
      this.config.get<string>('FRONTEND_URL', 'http://localhost:4200')
    }/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: `"Soporte Perfumes Catedral" <${
        this.config.get<string>('MAIL_USER', 'noreply@PerfumesCatedral.cl')
      }>`,
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
      'http://localhost:4200',
    );

    // Ajusta la URL al detalle de reserva que tengas en el front
    const reservationLink = `${baseUrl.replace(/\/+$/, '')}/profile/reservations`;

    const safeName = customerName || 'cliente';

    await this.transporter.sendMail({
      from: `"Perfumes Catedral" <${
        this.config.get<string>('MAIL_USER', 'noreply@PerfumesCatedral.cl')
      }>`,
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
