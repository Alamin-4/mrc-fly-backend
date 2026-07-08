// src/modules/auth/application/services/token.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    ) {}

    /** Short-lived access token (15 minutes) */
    generateAccessToken(payload: { userId: string; email: string; role: string }): string {
        return this.jwtService.sign(payload, {
            // FIX: Use JWT_ACCESS_SECRET consistently — was JWT_SECRET in env.ts (mismatch)
            secret: this.config.get<string>('JWT_ACCESS_SECRET'),
            expiresIn: '15m',
        });
    }

    /**
     * Generates a refresh token, stores its SHA-256 HASH in the DB, and returns the raw token.
     * SECURITY: If the DB is ever breached, the raw tokens are not exposed — only hashes.
     */
    async generateRefreshToken(userId: string, familyId?: string): Promise<string> {
        const rawToken = crypto.randomBytes(40).toString('hex');
        // SECURITY: Store only the hash — never the raw token
        const tokenHash = this.hashToken(rawToken);
        const newFamilyId = familyId ?? crypto.randomUUID();

        await this.prisma.refreshToken.create({
            data: {
                userId,
                token: tokenHash,
                familyId: newFamilyId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Return the raw token to the client (to be stored in HttpOnly cookie)
        return rawToken;
    }

    /**
     * Validates a refresh token with full rotation and reuse-detection.
     *
     * Key security properties:
     * 1. Hashes the incoming token before DB lookup.
     * 2. If the token is already revoked → family-wide revocation (reuse detected).
     * 3. Uses an optimistic-lock transaction to prevent the race condition where two
     *    concurrent requests both pass the isRevoked check and each get a new token.
     */
    async validateRefreshToken(rawToken: string) {
        const tokenHash = this.hashToken(rawToken);

        // Select only the fields we need to avoid loading unnecessary data (perf fix)
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: tokenHash },
            select: {
                id: true,
                isRevoked: true,
                expiresAt: true,
                familyId: true,
                user: { select: { id: true, email: true, role: true } },
            },
        });

        if (!storedToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (storedToken.isRevoked) {
            // SECURITY: Reuse of a revoked token = token theft scenario.
            // Revoke the ENTIRE family to force re-login on all devices that may
            // have been compromised by this stolen token chain.
            await this.prisma.refreshToken.updateMany({
                where: { familyId: storedToken.familyId },
                data: { isRevoked: true },
            });
            throw new UnauthorizedException(
                'Refresh token reuse detected. All sessions have been revoked for your security.',
            );
        }

        if (storedToken.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token expired. Please log in again.');
        }

        // SECURITY: Optimistic-lock transaction to prevent race condition.
        // Without this, two simultaneous requests with the same refresh token would
        // both pass the isRevoked === false check above and each receive a new token.
        // By using updateMany with WHERE isRevoked = false and checking count,
        // only one request can win — the second gets count=0 and is rejected.
        await this.prisma.$transaction(async (tx) => {
            const result = await tx.refreshToken.updateMany({
                where: { id: storedToken.id, isRevoked: false },
                data: { isRevoked: true },
            });

            if (result.count === 0) {
                // Another concurrent request already rotated this token first
                throw new UnauthorizedException('Refresh token already used. Please log in again.');
            }
        });

        return { user: storedToken.user, familyId: storedToken.familyId };
    }

    /** Generates a secure random token for email verification / password reset links */
    generateSecureToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /** SHA-256 hash of a token for secure DB storage */
    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}