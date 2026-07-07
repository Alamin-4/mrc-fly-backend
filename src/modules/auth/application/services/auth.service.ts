import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    HttpException,
    HttpStatus
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
    ) { }

    async register(dto: RegisterDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) throw new ConflictException('Email already registered. Please use a different email address.');

        const strength = this.passwordService.validateStrength(dto.password);
        if (!strength.valid) {
            throw new BadRequestException(strength.errors.join(', '));
        }

        const passwordHash = await this.passwordService.hash(dto.password);

        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                passwordHash,
                phone: dto.phone,
            },
        });

        const verificationToken = this.tokenService.generateSecureToken();
        await this.prisma.emailVerification.create({
            data: {
                userId: user.id,
                token: verificationToken,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        await this.mailService.sendVerificationEmail(user.email, verificationToken);

        const accessToken = this.tokenService.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = await this.tokenService.generateRefreshToken(user.id);

        return {
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            accessToken,
            refreshToken,
        };
    }

    async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {

        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil(
                (user.lockedUntil.getTime() - Date.now()) / 60000
            );

            throw new HttpException(
                `Account locked. Try again in ${minutesLeft} minutes`,
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        const isValid = await this.passwordService.compare(dto.password, user.passwordHash);
        if (!isValid) {

            const failedAttempts = user.failedAttempts + 1;
            const lockedUntil = failedAttempts >= this.MAX_FAILED_ATTEMPTS
                ? new Date(Date.now() + this.LOCK_TIME)
                : null;

            await this.prisma.user.update({
                where: { id: user.id },
                data: { failedAttempts, lockedUntil },
            });

            throw new UnauthorizedException('Invalid credentials');
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null },
        });

        const sessionToken = this.tokenService.generateSecureToken();
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: sessionToken,
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

    async logout(sessionToken: string) {
        await this.prisma.session.delete({
            where: { token: sessionToken },
        });
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) return { message: 'If email exists, reset link sent' };

        await this.prisma.passwordReset.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true },
        });

        const resetToken = this.tokenService.generateSecureToken();
        await this.prisma.passwordReset.create({
            data: {
                userId: user.id,
                token: resetToken,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });

        await this.mailService.sendPasswordResetEmail(email, resetToken);

        return { message: 'If email exists, reset link sent' };
    }

    async resetPassword(token: string, newPassword: string) {
        const resetRecord = await this.prisma.passwordReset.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const strength = this.passwordService.validateStrength(newPassword);
        if (!strength.valid) throw new BadRequestException(strength.errors.join(', '));
        const passwordHash = await this.passwordService.hash(newPassword);
        await this.prisma.user.update({
            where: { id: resetRecord.userId },
            data: { passwordHash },
        });

        await this.prisma.passwordReset.update({
            where: { id: resetRecord.id },
            data: { used: true },
        });

        await this.prisma.refreshToken.updateMany({
            where: { userId: resetRecord.userId },
            data: { isRevoked: true },
        });

        return { message: 'Password reset successful' };
    }

    async verifyEmail(token: string) {
        const record = await this.prisma.emailVerification.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!record || record.used || record.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired verification token');
        }

        await this.prisma.user.update({
            where: { id: record.userId },
            data: { emailVerified: new Date() },
        });

        await this.prisma.emailVerification.update({
            where: { id: record.id },
            data: { used: true },
        });

        return { message: 'Email verification successful' };
    }
}