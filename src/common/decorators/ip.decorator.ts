// src/common/decorators/ip.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IpAddress = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string => {
        const req = ctx.switchToHttp().getRequest();

        // FIX: x-forwarded-for can be a comma-separated list of IPs.
        // e.g. "203.0.113.5, 70.41.3.18, 60.173.234.100"
        // The leftmost is the original client IP; the rest are intermediate proxies.
        // We must parse only the first value. The full raw header is trivially spoofable
        // without 'trust proxy' enabled (set in main.ts via app.set('trust proxy', 1)).
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const firstIp = Array.isArray(forwarded)
                ? forwarded[0]
                : forwarded.split(',')[0];
            return firstIp.trim();
        }

        return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    },
);
