// src/modules/auth/application/dto/register.dto.ts
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    IsOptional,
} from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    // FIX: BCrypt silently truncates passwords longer than 72 bytes.
    // A user who sets a 200-char password would have only the first 72 chars validated.
    // We cap it here at the DTO level to make the limit explicit and visible.
    @MaxLength(72, { message: 'Password must not exceed 72 characters.' })
    password: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    phone?: string;
}