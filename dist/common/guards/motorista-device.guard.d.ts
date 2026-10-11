import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DeviceAuthLimiterService } from '../throttler/device-auth-limiter.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class MotoristaDeviceGuard implements CanActivate {
    private readonly prisma;
    private readonly limiter;
    private readonly reflector?;
    constructor(prisma: PrismaService, limiter: DeviceAuthLimiterService, reflector?: Reflector | undefined);
    private static readonly cienciasConfirmadas;
    canActivate(context: ExecutionContext): Promise<boolean>;
    private exigirCienciaPrivacidade;
}
