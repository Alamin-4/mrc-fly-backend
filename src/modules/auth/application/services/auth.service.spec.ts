// src/modules/auth/application/services/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/modules/mail/mail.service';
import {
    ConflictException,
    BadRequestException,
    UnauthorizedException,
    HttpException,
} from '@nestjs/common';

const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@mrcfly.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'USER',
    failedAttempts: 0,
    lockedUntil: null,
    emailVerified: null,
};

const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    session: {
        create: jest.fn(),
        deleteMany: jest.fn(),
    },
    emailVerification: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    passwordReset: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    refreshToken: {
        updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops) => {
        if (typeof ops === 'function') return ops(mockPrisma);
        return Promise.all(ops);
    }),
};

const mockPassword = {
    hash: jest.fn().mockResolvedValue('$2b$12$hashed'),
    compare: jest.fn(),
    validateStrength: jest.fn().mockReturnValue({ valid: true, errors: [] }),
};

const mockToken = {
    generateSecureToken: jest.fn().mockReturnValue('secure-token-abc'),
    generateAccessToken: jest.fn().mockReturnValue('access.jwt.token'),
    generateRefreshToken: jest.fn().mockResolvedValue('raw-refresh-token'),
    validateRefreshToken: jest.fn(),
};

const mockMail = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
};

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PasswordService, useValue: mockPassword },
                { provide: TokenService, useValue: mockToken },
                { provide: MailService, useValue: mockMail },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    // ─── register ───────────────────────────────────────────────────────────────
    describe('register', () => {
        it('should throw ConflictException if email already exists', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            await expect(
                service.register({ name: 'A', email: 'test@mrcfly.com', password: 'Abc123!@#' }),
            ).rejects.toThrow(ConflictException);
        });

        it('should return a message (no tokens) on successful registration', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.$transaction.mockImplementation(async (fn) => {
                return fn({ user: { create: jest.fn().mockResolvedValue(mockUser) }, emailVerification: { create: jest.fn() } });
            });
            const result = await service.register({ name: 'A', email: 'new@mrcfly.com', password: 'Abc123!@#' });
            expect(result).toHaveProperty('message');
            // Tokens must NOT be returned before email verification
            expect(result).not.toHaveProperty('accessToken');
            expect(result).not.toHaveProperty('refreshToken');
        });
    });

    // ─── login ──────────────────────────────────────────────────────────────────
    describe('login', () => {
        it('should throw UnauthorizedException for wrong password', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPassword.compare.mockResolvedValue(false);
            mockPrisma.user.update.mockResolvedValue({});
            await expect(
                service.login({ email: 'test@mrcfly.com', password: 'wrong' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw 429 when account is locked', async () => {
            const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 60_000) };
            mockPrisma.user.findUnique.mockResolvedValue(lockedUser);
            // Even with correct password, locked user should be rejected
            mockPassword.compare.mockResolvedValue(true);
            await expect(
                service.login({ email: 'test@mrcfly.com', password: 'Abc123!@#' }),
            ).rejects.toThrow(HttpException);
        });

        it('should return user + accessToken (no refreshToken in body) on success', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPassword.compare.mockResolvedValue(true);
            mockPrisma.user.update.mockResolvedValue({});
            mockPrisma.session.create.mockResolvedValue({});

            const result = await service.login({ email: 'test@mrcfly.com', password: 'Abc123!@#' });
            expect(result.user).toBeDefined();
            expect(result.accessToken).toBe('access.jwt.token');
            // refreshToken is returned from service (controller removes it from body)
            expect(result.refreshToken).toBe('raw-refresh-token');
        });
    });

    // ─── logout ─────────────────────────────────────────────────────────────────
    describe('logout', () => {
        it('should deleteMany sessions and revoke all refresh tokens for the user', async () => {
            mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
            mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

            await service.logout('user-1');

            expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
            });
            expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                data: { isRevoked: true },
            });
        });
    });

    // ─── resetPassword ──────────────────────────────────────────────────────────
    describe('resetPassword', () => {
        it('should throw BadRequestException for expired reset token', async () => {
            mockPrisma.passwordReset.findUnique.mockResolvedValue({
                id: 'pr-1',
                userId: 'user-1',
                used: false,
                expiresAt: new Date(Date.now() - 1000), // expired
                user: { id: 'user-1' },
            });
            await expect(service.resetPassword('token', 'NewPass1!')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should also delete sessions when password is reset', async () => {
            mockPrisma.passwordReset.findUnique.mockResolvedValue({
                id: 'pr-1',
                userId: 'user-1',
                used: false,
                expiresAt: new Date(Date.now() + 60_000),
                user: { id: 'user-1' },
            });

            const txOps: any[] = [];
            mockPrisma.$transaction.mockImplementation((ops) => {
                ops.forEach((op: any) => txOps.push(op));
                return Promise.resolve();
            });
            mockPrisma.session.deleteMany.mockReturnValue({ userId: 'user-1' });

            await service.resetPassword('valid-token', 'NewPass1!@#A');

            // session.deleteMany must be included in the transaction
            expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
            });
        });
    });
});
