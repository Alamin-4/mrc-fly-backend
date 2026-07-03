import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Next.js ফ্রন্টএন্ডের জন্য CORS অন করা
  app.enableCors({
    origin: ['http://localhost:3000'], // আপনার ফ্রন্টএন্ড এর পোর্ট
    credentials: true,
  });

  // DTO ভ্যালিডেশন এর জন্য গ্লোবাল পাইপ
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(3001); // ব্যাকএন্ড 3001 পোর্টে চলবে
  console.log('🚀 Backend is running on http://localhost:3001');
}
bootstrap();