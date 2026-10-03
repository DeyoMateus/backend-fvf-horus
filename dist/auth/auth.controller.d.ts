import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, ip: string, res: Response, userAgent?: string): Promise<{
        accessToken: string;
        expiresIn: number;
    }>;
    refresh(req: Request, ip: string, res: Response, userAgent?: string): Promise<{
        accessToken: string;
        expiresIn: number;
    }>;
    logout(req: Request, res: Response): Promise<void>;
    esqueciSenha(dto: EsqueciSenhaDto, ip: string, userAgent?: string): Promise<void>;
    redefinirSenha(dto: RedefinirSenhaDto, ip: string, userAgent?: string): Promise<void>;
}
