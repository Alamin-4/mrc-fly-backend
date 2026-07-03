// src/modules/auth/application/services/password.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
    private readonly SALT_ROUNDS = 12; // Industry standard

    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    // Password strength validation
    validateStrength(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) errors.push('Minimum 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('At least one uppercase');
        if (!/[a-z]/.test(password)) errors.push('At least one lowercase');
        if (!/[0-9]/.test(password)) errors.push('At least one number');
        if (!/[!@#$%^&*]/.test(password)) errors.push('At least one special char');

        return { valid: errors.length === 0, errors };
    }
}