import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initFirebase } from './firebase/firebase.init';

async function bootstrap() {
  initFirebase();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:4200',                    
      'https://catedral-dashboard.vercel.app',    
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
    }),
  );

  const configService = app.get(ConfigService);

  const port =
    configService.get<number>('PORT') ||
    Number(process.env.PORT) ||
    3000;

  await app.listen(port, '0.0.0.0');
}

bootstrap();
