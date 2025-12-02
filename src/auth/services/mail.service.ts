// src/auth/services/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface ReservationCreatedEmailPayload {
  to: string;           // correo del cliente
  reservationId: string;
  customerName?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend;
  private from: string;
  private frontendUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.error(
        '[MAIL] RESEND_API_KEY no configurada. Los correos no se podrán enviar.',
      );
    } else {
      this.resend = new Resend(apiKey);
    }

    // Remitente: viene de env, o el fallback de Resend
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      'Catedral Perfumes <onboarding@resend.dev>';

    // URL del front
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ||
      'https://perfumescatedral.vercel.app';
  }

  /* -------------------------------- RESET PASSWORD -------------------------------- */

  async sendResetPassEmail(to: string, token: string) {
    const base = this.frontendUrl.replace(/\/+$/, '');
    const resetlink = `${base}/reset-password?token=${token}`;

    this.logger.log(
      `[MAIL] Reset → a: ${to}`,
    );
    this.logger.log(`[MAIL] Link: ${resetlink}`);
    this.logger.log(`[MAIL] From usado: ${this.from}`);

    if (!this.resend) {
      this.logger.error('[MAIL] Resend no inicializado');
      return;
    }

    const { data, error } = await this.resend.emails.send({
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

    this.logger.log('[MAIL] Reset enviado OK:', { data, error });

    if (error) {
      this.logger.error('[MAIL] ERROR enviando mail de reset:', error);
    }
  }

  /* ------------------------------- RESERVA CREADA ---------------------------------- */

  async sendReservationCreatedEmail(payload: ReservationCreatedEmailPayload) {
    const { to, reservationId, customerName } = payload;

    const base = this.frontendUrl.replace(/\/+$/, '');
    const reservationLink = `${base}/profile/reservations`;
    const safeName = customerName || 'cliente';

    this.logger.log(`[MAIL] Reserva creada → a: ${to}`);
    this.logger.log(`[MAIL] From usado: ${this.from}`);

    if (!this.resend) {
      this.logger.error('[MAIL] Resend no inicializado');
      return;
    }

    const { data, error } = await this.resend.emails.send({
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

    this.logger.log('[MAIL] Reserva creada enviado OK:', { data, error });

    if (error) {
      this.logger.error('[MAIL] ERROR enviando mail de reserva:', error);
    }
  }
}
