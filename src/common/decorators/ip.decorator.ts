import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IpAddress = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string => {
        const req = ctx.switchToHttp().getRequest();
        return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    },
);
