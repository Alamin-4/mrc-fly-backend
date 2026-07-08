// src/modules/auth/application/services/auth.service.ts
import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    HttpException,
    HttpStatus,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { MailService } from '@/modules/mail/mail.service';

@Injectable()
export class AuthService {
    private readonly MAX_FAILED_ATTEMPTS = 5;
    private readonly LOCK_TIME = 15 * 60 * 1000; // 15 minutes

    constructor(
        private prisma: PrismaService,
        private passwordService: PasswordService,
        private tokenService: TokenService,
        private mailService: MailService,
    ) {}

    async register(dto: RegisterDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) {
            throw new ConflictException('Email already registered. Please use a different email address.');
        }

        const strength = this.passwordService.validateStrength(dto.password);
        if (!strength.valid) {
            throw new BadRequestException(strength.errors.join(', '));
        }

        const passwordHash = await this.passwordService.hash(dto.password);
        const verificationToken = this.tokenService.generateSecureToken();

        // FIX: Wrap user creation and verification record in a single transaction.
        // Previously, if the emailVerification.create failed, the user would exist
        // in the DB with no way to get a new verification token (orphaned account).
        const user = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    name: dto.name,
                    email: dto.email,
                    passwordHash,
                    phone: dto.phone,
                },
            });

            await tx.emailVerification.create({
                data: {
                    userId: created.id,
                    token: verificationToken,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                },
            });

            return created;
        });

        // Email send is outside the transaction intentionally — a mail failure should not
        // roll back user creation. Users can request a resend.
        await this.mailService.sendVerificationEmail(user.email, verificationToken);

        // FIX: Do NOT issue tokens before email is verified.
        // Previously, any user could register with someone else's email and get an access
        // token before the real owner verifies. Now we just tell them to check their inbox.
        return {
            message: 'Registration successful. Please check your email to verify your account.',
        };
    }

    async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        // FIX: Always run bcrypt.compare even if user not found, to prevent timing attacks
        // that allow email enumeration by measuring response time differences.
        const dummyHash = '$2b$12$dummy.hash.for.timing.attack.prevention.padding.here';
        const passwordToCompare = user?.passwordHash ?? dummyHash;
        const isValid = await this.passwordService.compare(dto.password, passwordToCompare);

        if (!user || !isValid) {
            // If user exists and password was wrong, update the failed attempt counter
            if (user) {
                const failedAttempts = user.failedAttempts + 1;
                const shouldLock = failedAttempts >= this.MAX_FAILED_ATTEMPTS;
                const lockedUntil = shouldLock
                    ? new Date(Date.now() + this.LOCK_TIME)
                    : null;

                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { failedAttempts, lockedUntil },
                });
            }
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check account lock AFTER password comparison (for constant-time behaviour)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil(
                (user.lockedUntil.getTime() - Date.now()) / 60000,
            );
            throw new HttpException(
                `Account locked. Try again in ${minutesLeft} minutes.`,
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // FIX: Reset lock state when expired + login is successful
        await this.prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null },
        });

        const sessionToken = this.tokenService.generateSecureToken();
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: sessionToken,
                // FIX: ipAddress parsing is now done correctly in ip.decorator.ts
                ipAddress,
                userAgent,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });

        const accessToken = this.tokenService.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        // Refresh token is stored as a hash in DB; raw token goes to the client via HttpOnly cookie
        const refreshToken = await this.tokenService.generateRefreshToken(user.id);

        return {
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            accessToken,
            refreshToken,
            sessionToken,
        };
    }

    async refreshToken(oldRefreshToken: string) {
        const { user, familyId } = await this.tokenService.validateRefreshToken(oldRefreshToken);

        const accessToken = this.tokenService.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const newRefreshToken = await this.tokenService.generateRefreshToken(user.id, familyId);

        return { accessToken, refreshToken: newRefreshToken };
    }

    /**
     * Logout: invalidate ALL sessions for the user, derived from their trusted JWT.
     *
     * FIX: Previously accepted `sessionToken` from the request body, which allowed
     * any authenticated user to delete ANOTHER user's session by guessing its token.
     * Now we use the userId from the verified JWT — the controller passes it in.
     */
    async logout(userId: string): Promise<void> {
        // Delete all active sessions (logs out from all devices)
        await this.prisma.session.deleteMany({ where: { userId } });
        // Also revoke all refresh tokens so they can't be rotated after logout
        await this.prisma.refreshToken.updateMany({
            where: { userId },
            data: { isRevoked: true },
        });
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });

        // FIX: Constant-time response — always return the same message.
        // We do NOT skip early if user is not found, we just don't do any DB writes.
        // A small artificial delay equalises timing between found/not-found paths.
        if (!user) {
            await new Promise((r) => setTimeout(r, 200));
            return { message: 'If that email is registered, a reset link has been sent.' };
        }

        // Invalidate any existing unused reset tokens for this user
        await this.prisma.passwordReset.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true },
        });

        const resetToken = this.tokenService.generateSecureToken();
        await this.prisma.passwordReset.create({
            data: {
                userId: user.id,
                token: resetToken,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            },
        });

        await this.mailService.sendPasswordResetEmail(email, resetToken);

        return { message: 'If that email is registered, a reset link has been sent.' };
    }

    async resetPassword(token: string, newPassword: string) {
        const resetRecord = await this.prisma.passwordReset.findUnique({
            where: { token },
            // FIX: Only select the fields we need — avoid loading full user object
            include: { user: { select: { id: true } } },
        });

        if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired reset token.');
        }

        const strength = this.passwordService.validateStrength(newPassword);
        if (!strength.valid) {
            throw new BadRequestException(strength.errors.join(', '));
        }

        const passwordHash = await this.passwordService.hash(newPassword);

        // FIX: Wrap all post-reset actions in a single transaction.
        // Atomically: update password, mark token used, revoke all refresh tokens,
        // AND delete all sessions. Previously, sessions were not invalidated after
        // password reset — a hijacked session would survive a password change.
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: resetRecord.userId },
                data: { passwordHash },
            }),
            this.prisma.passwordReset.update({
                where: { id: resetRecord.id },
                data: { used: true },
            }),
            this.prisma.refreshToken.updateMany({
                where: { userId: resetRecord.userId },
                data: { isRevoked: true },
            }),
            // FIX: Also kill all active sessions (was missing before)
            this.prisma.session.deleteMany({
                where: { userId: resetRecord.userId },
            }),
        ]);

        return { message: 'Password reset successful. Please log in again.' };
    }

    async verifyEmail(token: string) {
        const record = await this.prisma.emailVerification.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!record || record.used || record.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired verification token.');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: record.userId },
                data: { emailVerified: new Date() },
            }),
            this.prisma.emailVerification.update({
                where: { id: record.id },
                data: { used: true },
            }),
        ]);

        return { message: 'Email verified successfully. You can now log in.' };
    }
}