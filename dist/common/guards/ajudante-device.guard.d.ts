import { CanActivate, ExecutionContext } from '@nestjs/common';
import { DeviceAuthLimiterService } from '../throttler/device-auth-limiter.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class AjudanteDeviceGuard implements CanActivate {
    private readonly prisma;
    private readonly limiter;
    constructor(prisma: PrismaService, limiter: DeviceAuthLimiterService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
