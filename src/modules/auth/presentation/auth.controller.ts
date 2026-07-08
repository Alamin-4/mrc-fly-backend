// src/modules/auth/presentation/auth.controller.ts
import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
    UseGuards,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../application/services/auth.service';
import { RegisterDto } from '../application/dto/register.dto';
import { LoginDto } from '../application/dto/login.dto';
import { ForgotPasswordDto } from '../application/dto/forgot-password.dto';
import { ResetPasswordDto } from '../application/dto/reset-password.dto';
import { VerifyEmailDto } from '../application/dto/verify-email.dto';
import { IpAddress } from '@/common/decorators/ip.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';

// Cookie config shared between login and refresh rotation
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,   // Prevents JavaScript access — XSS cannot steal the token
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'strict' as const, // Prevents CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches token lifetime)
    path: '/auth',   // Scoped: cookie only sent to /auth/* routes
};

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Public()
    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(
        @Body() dto: LoginDto,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.login(dto, ip, userAgent);

        // FIX: Set refresh token in an HttpOnly cookie instead of returning it in
        // the response body. This prevents XSS attacks from stealing the refresh token.
        // The access token (short-lived) is still returned in the body for API clients.
        res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

        // Do not expose refreshToken in the response body
        const { refreshToken: _, ...safeResult } = result;
        return safeResult;
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        // FIX: Read refresh token from HttpOnly cookie, not the request body.
        // This is the gold-standard pattern — XSS cannot access HttpOnly cookies.
        const refreshToken = (req as any).cookies?.['refresh_token'];
        if (!refreshToken) {
            throw new UnauthorizedException('No refresh token provided.');
        }

        const tokens = await this.authService.refreshToken(refreshToken);

        // Rotate the cookie with the new refresh token
        res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

        // Return only the new access token in the body
        return { accessToken: tokens.accessToken };
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(
        @CurrentUser() user: { id: string },
        @Res({ passthrough: true }) res: Response,
    ) {
        // FIX: userId comes from the verified JWT — not from the request body.
        // The previous implementation accepted a sessionToken from the body, which
        // allowed an authenticated attacker to logout ANY user's session by guessing
        // or brute-forcing the token value.
        await this.authService.logout(user.id);

        // Clear the HttpOnly cookie
        res.clearCookie('refresh_token', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

        return { success: true, message: 'Logged out successfully.' };
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('verify-email')
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto.token);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() user: { id: string; email: string; role: string }) {
        // FIX: Typed return — was `any` before which bypasses type safety
        return user;
    }
}