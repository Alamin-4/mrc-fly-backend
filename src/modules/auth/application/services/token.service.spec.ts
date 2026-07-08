// src/modules/auth/application/services/token.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

const mockPrisma = {
    refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
    },
};

const mockJwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
const mockConfig = { get: jest.fn().mockReturnValue('test-secret') };

describe('TokenService', () => {
    let service: TokenService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenService,
                { provide: JwtService, useValue: mockJwt },
                { provide: ConfigService, useValue: mockConfig },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<TokenService>(TokenService);
    });

    // ─── generateAccessToken ────────────────────────────────────────────────────
    describe('generateAccessToken', () => {
        it('should call jwtService.sign with correct payload and options', () => {
            service.generateAccessToken({ userId: '1', email: 'a@b.com', role: 'USER' });
            expect(mockJwt.sign).toHaveBeenCalledWith(
                { userId: '1', email: 'a@b.com', role: 'USER' },
                { secret: 'test-secret', expiresIn: '15m' },
            );
        });
    });

    // ─── validateRefreshToken ───────────────────────────────────────────────────
    describe('validateRefreshToken', () => {
        const validToken = {
            id: 'rt-id-1',
            isRevoked: false,
            expiresAt: new Date(Date.now() + 60_000),
            familyId: 'family-1',
            user: { id: 'user-1', email: 'a@b.com', role: 'USER' },
        };

        it('should throw UnauthorizedException for unknown token', async () => {
            mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
            await expect(service.validateRefreshToken('bad-token')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should revoke entire family and throw when reused (revoked) token is presented', async () => {
            mockPrisma.refreshToken.findUnique.mockResolvedValue({ ...validToken, isRevoked: true });
            await expect(service.validateRefreshToken('reused-token')).rejects.toThrow(
                UnauthorizedException,
            );
            // Family-wide revocation must be called
            expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
                where: { familyId: 'family-1' },
                data: { isRevoked: true },
            });
        });

        it('should throw UnauthorizedException for expired token', async () => {
            mockPrisma.refreshToken.findUnique.mockResolvedValue({
                ...validToken,
                expiresAt: new Date(Date.now() - 1000), // in the past
            });
            await expect(service.validateRefreshToken('expired-token')).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });
});
