import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
    async sendVerificationEmail(email: string, token: string) {
        console.log(`📧 Verification email sent to ${email} with token: ${token}`);
        // TODO: Implement actual email sending with nodemailer
    }

    async sendPasswordResetEmail(email: string, token: string) {
        console.log(`📧 Password reset email sent to ${email} with token: ${token}`);
        // TODO: Implement actual email sending
    }

    async sendWelcomeEmail(email: string, name: string) {
        console.log(`📧 Welcome email sent to ${email}`);
        // TODO: Implement actual email sending
    }
}