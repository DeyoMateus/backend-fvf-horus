import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { EsqueciSenhaSuperAdminDto } from './dto/esqueci-senha-super-admin.dto';
import { RedefinirSenhaSuperAdminDto } from './dto/redefinir-senha-super-admin.dto';
export declare class SuperAdminAuthController {
    private readonly superAdminAuthService;
    private readonly config;
    constructor(superAdminAuthService: SuperAdminAuthService, config: ConfigService);
    login(dto: LoginSuperAdminDto, ip: string, res: Response, userAgent?: string): Promise<{
        accessToken: string;
        expiresIn: number;
    }>;
    refresh(req: Request, ip: string, res: Response, userAgent?: string): Promise<{
        accessToken: string;
        expiresIn: number;
    }>;
    logout(req: Request, res: Response): Promise<void>;
    esqueciSenha(dto: EsqueciSenhaSuperAdminDto, ip: string, userAgent?: string): Promise<void>;
    redefinirSenha(dto: RedefinirSenhaSuperAdminDto, ip: string, userAgent?: string): Promise<void>;
}
