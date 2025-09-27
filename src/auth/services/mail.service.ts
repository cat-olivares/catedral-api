import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
  	this.transporter = nodemailer.createTransport({
			host: config.get<string>('MAIL_HOST', 'smtp.ethereal.email'),
			port: config.get<number>('MAIL_PORT', 587),
			auth: {
				user: config.get<string>('MAIL_USER', 'thelma84@ethereal.email'),
				pass: config.get<string>('MAIL_PASS', 'm5qHPHnwvzUjptRkcx')
			}
  	});
	}

  async sendResetPassEmail(to: string, token: string) {
		const resetlink = `${this.config.get<string>('FRONTEND_URL', 'http://localhost:4200')}/reset-password?token=${token}`;
    
		await this.transporter.sendMail({
			from: `"Soporte Perfumes Catedral" <${this.config.get<string>('MAIL_USER', 'noreply@PerfumesCatedral.cl')}>`,
      to,
      subject: 'Restablecer contraseña',
      html: `<p>Para restablecer tu contraseña, <a href="${resetlink}">Haz click aquí</a></p><p>Si no solicitaste un cambio de contraseña, ignora este correo.</p>`,
    });

  }
}