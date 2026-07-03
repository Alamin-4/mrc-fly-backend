// src/modules/auth/application/services/token.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
    constructor(
        private jwtService: JwtService,
        private config: ConfigService,
        private prisma: PrismaService,
    ) { }

    // Short-lived access token (15 minutes)
    generateAccessToken(payload: { userId: string; email: string; role: string }) {
        return this.jwtService.sign(payload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: '15m',
        });
    }

    // Long-lived refresh token (7 days), stored in DB
    async generateRefreshToken(userId: string, familyId?: string) {
        const token = crypto.randomBytes(40).toString('hex');
        const newFamilyId = familyId || crypto.randomUUID();

        await this.prisma.refreshToken.create({
            data: {
                userId,
                token,
                familyId: newFamilyId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return token;
    }

    // Validate refresh token with rotation
    async validateRefreshToken(token: string) {
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!storedToken) throw new Error('Invalid token');
        if (storedToken.isRevoked) throw new Error('Token revoked');
        if (storedToken.expiresAt < new Date()) throw new Error('Token expired');

        // Token rotation: revoke old, issue new
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { isRevoked: true },
        });

        return { user: storedToken.user, familyId: storedToken.familyId };
    }

    // Generate secure random token for email verification/password reset
    generateSecureToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }
}