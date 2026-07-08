// src/modules/auth/infrastructure/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService,
        private prisma: PrismaService,
    ) {
        // FIX: JWT_ACCESS_SECRET key name is now consistent across all files.
        // Previously env.ts used JWT_SECRET while this file used JWT_ACCESS_SECRET — mismatch.
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
            throw new Error('JWT_ACCESS_SECRET is not defined in environment variables');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: secret,
            ignoreExpiration: false,
        });
    }

    async validate(payload: { userId: string; email: string; role: string }) {
        // NOTE: This DB lookup runs on every authenticated request.
        // TODO (Performance): Add Redis caching — cache user:{id} with 5-min TTL
        // and invalidate on user update/lock to avoid this DB hit per request.
        const user = await this.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, role: true, lockedUntil: true },
        });

        if (!user) {
            throw new UnauthorizedException('User account no longer exists.');
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new UnauthorizedException('Account is currently locked. Please try again later.');
        }

        // Return only safe, non-sensitive fields to req.user
        return { id: user.id, email: user.email, role: user.role };
    }
}