import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
export declare class FusoClienteInterceptor implements NestInterceptor {
    private readonly prisma;
    private readonly logger;
    private readonly ultimoPorUsuario;
    constructor(prisma: PrismaService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
