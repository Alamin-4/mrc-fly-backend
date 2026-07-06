import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthService } from '../application/services/auth.service';
import { RegisterDto } from '../application/dto/register.dto';
import { LoginDto } from '../application/dto/login.dto';
import { RefreshTokenDto } from '../application/dto/refresh-token.dto';
import { ForgotPasswordDto } from '../application/dto/forgot-password.dto';
import { ResetPasswordDto } from '../application/dto/reset-password.dto';
import { VerifyEmailDto } from '../application/dto/verify-email.dto';
import { IpAddress } from '@/common/decorators/ip.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Public()
    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('login')
    login(
        @Body() dto: LoginDto,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ) {
        return this.authService.login(dto, ip, userAgent);
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshToken(dto.refreshToken);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Body('sessionToken') sessionToken: string) {
        await this.authService.logout(sessionToken);
        return { success: true, message: 'Logged out successfully' };
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
    getMe(@CurrentUser() user: any) {
        return user;
    }
}