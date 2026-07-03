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
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
            throw new Error('JWT_ACCESS_SECRET is not defined');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: secret,
            ignoreExpiration: false,
        });
    }

    async validate(payload: { userId: string; email: string; role: string }) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.userId },
        });

        if (!user) throw new UnauthorizedException('User not found');
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new UnauthorizedException('Account locked');
        }

        return { id: user.id, email: user.email, role: user.role };
    }
}