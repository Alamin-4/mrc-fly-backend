import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './application/services/auth.service';
import { AuthController } from './presentation/auth.controller';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { PasswordService } from './application/services/password.service';
import { TokenService } from './application/services/token.service';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                secret: config.get<string>('JWT_ACCESS_SECRET'),
                signOptions: { expiresIn: 60 * 15 }, // 15 minutes in seconds
            }),
        }),
        MailModule,
    ],
    providers: [AuthService, PasswordService, TokenService, JwtStrategy],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }