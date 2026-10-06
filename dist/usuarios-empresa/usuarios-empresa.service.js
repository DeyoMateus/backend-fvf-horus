"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsuariosEmpresaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
let UsuariosEmpresaService = class UsuariosEmpresaService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async create(dto, grupoId, actorId) {
        const existente = await this.prisma.usuarioEmpresa.findUnique({
            where: { email: dto.email },
        });
        if (existente)
            throw new common_1.ConflictException('E-mail já cadastrado para outro usuário');
        const senhaHash = await bcrypt.hash(dto.senha, 12);
        const usuario = await this.prisma.usuarioEmpresa.create({
            data: {
                nome: dto.nome,
                email: dto.email,
                senhaHash,
                papel: dto.papel,
                telefoneWhatsapp: dto.telefoneWhatsapp,
                grupoId,
            },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                telefoneWhatsapp: true,
                telefoneGerenciamentoRisco: true,
                createdAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId,
            acao: 'USUARIO_EMPRESA_CRIADO',
            entidade: 'UsuarioEmpresa',
            entidadeId: usuario.id,
            detalhes: { papel: dto.papel, email: dto.email },
        });
        return usuario;
    }
    list(grupoIdSolicitante) {
        return this.prisma.usuarioEmpresa.findMany({
            where: { grupoId: grupoIdSolicitante },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                telefoneWhatsapp: true,
                telefoneGerenciamentoRisco: true,
                createdAt: true,
            },
        });
    }
    async atualizarStatus(id, dto, grupoIdSolicitante, actorId) {
        if (id === actorId) {
            throw new common_1.ForbiddenException('Você não pode alterar o próprio status de acesso');
        }
        const usuario = await this.prisma.usuarioEmpresa.findUnique({
            where: { id },
        });
        if (!usuario || usuario.grupoId !== grupoIdSolicitante) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        const atualizado = await this.prisma.usuarioEmpresa.update({
            where: { id },
            data: { ativo: dto.ativo },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                telefoneWhatsapp: true,
                telefoneGerenciamentoRisco: true,
                createdAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId,
            acao: dto.ativo
                ? 'USUARIO_EMPRESA_REATIVADO'
                : 'USUARIO_EMPRESA_DESATIVADO',
            entidade: 'UsuarioEmpresa',
            entidadeId: id,
        });
        return atualizado;
    }
    async obterMeuPerfil(usuarioId) {
        const usuario = await this.prisma.usuarioEmpresa.findUnique({
            where: { id: usuarioId },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                telefoneWhatsapp: true,
                telefoneGerenciamentoRisco: true,
                createdAt: true,
            },
        });
        if (!usuario)
            throw new common_1.NotFoundException('Usuário não encontrado');
        return usuario;
    }
    async atualizarMeuPerfil(usuarioId, dto) {
        if (dto.email) {
            const existente = await this.prisma.usuarioEmpresa.findUnique({
                where: { email: dto.email },
            });
            if (existente && existente.id !== usuarioId) {
                throw new common_1.ConflictException('E-mail já cadastrado para outro usuário');
            }
        }
        let telefoneGr = undefined;
        if (dto.telefoneGerenciamentoRisco !== undefined) {
            const atual = await this.prisma.usuarioEmpresa.findUnique({
                where: { id: usuarioId },
                select: { papel: true },
            });
            if (atual?.papel === 'ADMIN')
                telefoneGr = dto.telefoneGerenciamentoRisco;
        }
        const atualizado = await this.prisma.usuarioEmpresa.update({
            where: { id: usuarioId },
            data: {
                nome: dto.nome ?? undefined,
                email: dto.email ?? undefined,
                telefoneWhatsapp: dto.telefoneWhatsapp ?? undefined,
                telefoneGerenciamentoRisco: telefoneGr,
            },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                telefoneWhatsapp: true,
                telefoneGerenciamentoRisco: true,
                createdAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'USUARIO_ATUALIZOU_PROPRIO_PERFIL',
            entidade: 'UsuarioEmpresa',
            entidadeId: usuarioId,
        });
        return atualizado;
    }
};
exports.UsuariosEmpresaService = UsuariosEmpresaService;
exports.UsuariosEmpresaService = UsuariosEmpresaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], UsuariosEmpresaService);
//# sourceMappingURL=usuarios-empresa.service.js.map