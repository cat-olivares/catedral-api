import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend;
  private from: string;
  private frontendUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);

    this.from =
      this.config.get<string>('MAIL_FROM') ||
      'Catedral Perfumes <onboarding@resend.dev>';

    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ??
      'https://perfumescatedral.vercel.app';
  }

  async sendResetPassEmail(to: string, token: string) {
    const resetlink = `${this.frontendUrl.replace(/\/+$/, '')}/reset-password?token=${token}`;

    this.logger.log(`[MAIL] Reset → a: ${to}`);
    this.logger.log(`[MAIL] Link: ${resetlink}`);
    this.logger.log(`[MAIL] From usado: ${this.from}`);

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
}
