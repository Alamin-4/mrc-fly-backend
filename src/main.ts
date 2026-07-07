import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Monitor, NestJSPulseInterceptor, expressPulseMiddleware } from 'pulse-monitor';
import { envVars } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const monitor = new Monitor({
    dashboardEndpoint: "/pulse-monitor",
    maxBufferSize: 5000,
    enableThreatDetection: true,
    authSecret: 'admin123'
  });

  app.use(expressPulseMiddleware(monitor));
  app.useGlobalInterceptors(new NestJSPulseInterceptor(monitor));

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(envVars.PORT as string);
  console.log(`🚀 Backend is running on http://localhost:${envVars.PORT}`);
}
bootstrap();