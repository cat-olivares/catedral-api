// src/auth/services/mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface ReservationCreatedEmailPayload {
  to: string;
  reservationId: string;
  customerName?: string;
}

@Injectable()
export class MailService {
  private resend: Resend;
  private from: string;
  private frontendUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      console.warn(
        '[MAIL] RESEND_API_KEY no configurada, los correos no se enviarán',
      );
    }

    this.resend = new Resend(apiKey);
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      'Catedral Perfumes <catedralperfumes@gmail.com>';

    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ||
      'https://perfumescatedral.vercel.app';
  }

  private buildFrontendUrl(path: string) {
    return `${this.frontendUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  async sendResetPassEmail(to: string, token: string) {
    const resetlink = this.buildFrontendUrl(`reset-password?token=${token}`);

    console.log('[MAIL] Reset → a:', to);
    console.log('[MAIL] Link:', resetlink);

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Restablecer contraseña',
        html: `
          <p>Para restablecer tu contraseña, 
            <a href="${resetlink}">haz click aquí</a>.
          </p>
          <p>Si no solicitaste un cambio de contraseña, ignora este correo.</p>
        `,
      });

      console.log('[MAIL] Reset enviado OK:', result);
    } catch (err) {
      console.error('[MAIL] ERROR enviando mail de reset:', err);
      // no tiramos la API abajo
    }
  }

  async sendReservationCreatedEmail(payload: ReservationCreatedEmailPayload) {
    const { to, reservationId, customerName } = payload;

    const reservationLink = this.buildFrontendUrl('profile/reservations');
    const safeName = customerName || 'cliente';

    console.log('[MAIL] Reserva → a:', to, 'reserva:', reservationId);

    try {
      const result = await this.resend.emails.send({
        from: this.from,
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

      console.log('[MAIL] Reserva enviada OK:', result);
    } catch (err) {
      console.error('[MAIL] ERROR enviando mail de reserva:', err);
    }
  }
}
