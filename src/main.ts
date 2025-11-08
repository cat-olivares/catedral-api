import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initFirebase } from './firebase/firebase.init';

const config = new ConfigService();
async function bootstrap() {
  initFirebase();

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    validateCustomDecorators: true,
  }));

  const config = app.get(ConfigService);
  
  await app.listen(config.get<number>('PORT', 3000));
}

bootstrap();
