// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),

        // FIX: Global rate limiting to protect against brute-force and DoS attacks.
        // These are conservative defaults. Per-route overrides can be added with
        // @Throttle({ default: { limit: 5, ttl: 60000 } }) on specific endpoints.
        ThrottlerModule.forRoot([
            {
                name: 'short',
                ttl: 1000,   // 1 second window
                limit: 10,   // max 10 requests per second per IP
            },
            {
                name: 'medium',
                ttl: 60000,  // 1 minute window
                limit: 100,  // max 100 requests per minute per IP
            },
        ]),

        PrismaModule,
        AuthModule,
        MailModule,
    ],
    providers: [
        // Apply ThrottlerGuard globally to all routes
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}