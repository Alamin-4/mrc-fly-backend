// src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Monitor, NestJSPulseInterceptor, expressPulseMiddleware } from 'pulse-monitor';
import { envVars } from './config/env';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // FIX: Enable trust proxy so that Express correctly resolves req.ip
    // behind a reverse proxy (Nginx, Cloudflare, etc.).
    // Without this, req.ip is always the proxy's IP, not the real client IP.
    app.set('trust proxy', 1);

    // FIX: Helmet adds 11 HTTP security headers in one call:
    // Content-Security-Policy, X-Content-Type-Options, X-Frame-Options,
    // Strict-Transport-Security, Referrer-Policy, and more.
    app.use(helmet());

    // FIX: cookie-parser is required to read HttpOnly cookies (refresh token rotation).
    app.use(cookieParser());

    // FIX: authSecret moved to environment variable — hardcoded 'admin123' was a
    // plaintext credential committed to source control.
    const monitor = new Monitor({
        dashboardEndpoint: '/pulse-monitor',
        maxBufferSize: 5000,
        enableThreatDetection: true,
        authSecret: envVars.PULSE_MONITOR_SECRET as string,
    });

    app.use(expressPulseMiddleware(monitor));
    app.useGlobalInterceptors(new NestJSPulseInterceptor(monitor));

    // FIX: Drive CORS origins from environment variable to support multiple environments.
    // Previously hardcoded to localhost:3000 only.
    const allowedOrigins = (envVars.ALLOWED_ORIGINS as string)
        ? (envVars.ALLOWED_ORIGINS as string).split(',').map((o) => o.trim())
        : ['http://localhost:3000'];

    app.enableCors({
        origin: allowedOrigins,
        credentials: true, // Required for cookies to be sent cross-origin
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,           // Strip unknown properties
            forbidNonWhitelisted: true, // Reject requests with unknown properties
            transform: true,           // Auto-transform payloads to DTO classes
        }),
    );

    await app.listen(envVars.PORT as string);
    console.log(`🚀 Backend is running on http://localhost:${envVars.PORT}`);
}

bootstrap();