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
exports.SuperAdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
let SuperAdminService = class SuperAdminService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async criarEmpresaMae(dto, superAdminId) {
        const [empresaExistente, adminExistente] = await Promise.all([
            this.prisma.empresa.findUnique({ where: { cnpj: dto.cnpjEmpresa } }),
            this.prisma.usuarioEmpresa.findUnique({
                where: { email: dto.emailAdmin },
            }),
        ]);
        if (empresaExistente)
            throw new common_1.ConflictException('CNPJ já cadastrado');
        if (adminExistente)
            throw new common_1.ConflictException('E-mail já cadastrado para outro usuário');
        const senhaHash = await bcrypt.hash(dto.senhaAdmin, 12);
        const grupoId = (0, crypto_1.randomUUID)();
        const empresaId = (0, crypto_1.randomUUID)();
        const adminId = (0, crypto_1.randomUUID)();
        const operacoes = [
            this.prisma.$executeRawUnsafe("SET LOCAL app.grupo_atual = '__sistema__'"),
            this.prisma.cru.grupo.create({
                data: { id: grupoId, razaoSocial: dto.razaoSocialGrupo },
            }),
            this.prisma.cru.empresa.create({
                data: {
                    id: empresaId,
                    razaoSocial: dto.razaoSocialEmpresa,
                    cnpj: dto.cnpjEmpresa,
                    grupoId,
                    registroInpiAfd: dto.registroInpiAfd,
                },
            }),
            this.prisma.cru.usuarioEmpresa.create({
                data: {
                    id: adminId,
                    nome: dto.nomeAdmin,
                    email: dto.emailAdmin,
                    senhaHash,
                    papel: client_1.PapelUsuario.ADMIN,
                    grupoId,
                },
                select: {
                    id: true,
                    nome: true,
                    email: true,
                    papel: true,
                    ativo: true,
                    createdAt: true,
                },
            }),
        ];
        const [, grupo, empresa, admin] = (await this.prisma.$transaction(operacoes));
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: 'EMPRESA_MAE_PROVISIONADA',
            entidade: 'Grupo',
            entidadeId: grupo.id,
            detalhes: {
                empresaId: empresa.id,
                cnpj: empresa.cnpj,
                adminId: admin.id,
                adminEmail: admin.email,
            },
        });
        return { grupo, empresa, admin };
    }
    async listarGrupos() {
        const grupos = await this.prisma.grupo.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { empresas: true, usuarios: true } },
                empresas: { select: { _count: { select: { motoristas: true } } } },
            },
        });
        return grupos.map((g) => ({
            id: g.id,
            razaoSocial: g.razaoSocial,
            createdAt: g.createdAt,
            totalEmpresas: g._count.empresas,
            totalUsuarios: g._count.usuarios,
            totalMotoristas: g.empresas.reduce((soma, e) => soma + e._count.motoristas, 0),
        }));
    }
    async obterGrupo(grupoId) {
        const grupo = await this.prisma.grupo.findUnique({
            where: { id: grupoId },
            include: {
                empresas: {
                    orderBy: { razaoSocial: 'asc' },
                    include: { _count: { select: { motoristas: true } } },
                },
                usuarios: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        papel: true,
                        ativo: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!grupo)
            throw new common_1.NotFoundException('Grupo não encontrado');
        return {
            id: grupo.id,
            razaoSocial: grupo.razaoSocial,
            createdAt: grupo.createdAt,
            empresas: grupo.empresas.map((e) => ({
                id: e.id,
                razaoSocial: e.razaoSocial,
                cnpj: e.cnpj,
                ativo: e.ativo,
                registroInpiAfd: e.registroInpiAfd,
                totalMotoristas: e._count.motoristas,
            })),
            usuarios: grupo.usuarios,
        };
    }
    async atualizarGrupo(grupoId, dto, superAdminId) {
        const grupo = await this.prisma.grupo.findUnique({
            where: { id: grupoId },
        });
        if (!grupo)
            throw new common_1.NotFoundException('Grupo não encontrado');
        const atualizado = await this.prisma.grupo.update({
            where: { id: grupoId },
            data: { razaoSocial: dto.razaoSocial },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: 'GRUPO_ATUALIZADO_PELO_SUPER_ADMIN',
            entidade: 'Grupo',
            entidadeId: grupoId,
            detalhes: {
                razaoSocialAnterior: grupo.razaoSocial,
                razaoSocialNova: dto.razaoSocial,
            },
        });
        return atualizado;
    }
    async atualizarEmpresa(empresaId, dto, superAdminId) {
        const empresa = await this.prisma.empresa.findUnique({
            where: { id: empresaId },
        });
        if (!empresa)
            throw new common_1.NotFoundException('Empresa não encontrada');
        if (dto.cnpj && dto.cnpj !== empresa.cnpj) {
            const existente = await this.prisma.empresa.findUnique({
                where: { cnpj: dto.cnpj },
            });
            if (existente)
                throw new common_1.ConflictException('CNPJ já cadastrado em outra empresa');
        }
        const atualizada = await this.prisma.empresa.update({
            where: { id: empresaId },
            data: {
                razaoSocial: dto.razaoSocial ?? undefined,
                cnpj: dto.cnpj ?? undefined,
                registroInpiAfd: dto.registroInpiAfd ?? undefined,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: 'EMPRESA_ATUALIZADA_PELO_SUPER_ADMIN',
            entidade: 'Empresa',
            entidadeId: empresaId,
            detalhes: {
                antes: { razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj },
                depois: dto,
            },
        });
        return atualizada;
    }
    async atualizarStatusEmpresa(empresaId, ativo, superAdminId) {
        const empresa = await this.prisma.empresa.findUnique({
            where: { id: empresaId },
        });
        if (!empresa)
            throw new common_1.NotFoundException('Empresa não encontrada');
        const atualizada = await this.prisma.empresa.update({
            where: { id: empresaId },
            data: { ativo },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: 'EMPRESA_STATUS_ALTERADO_PELO_SUPER_ADMIN',
            entidade: 'Empresa',
            entidadeId: empresaId,
            detalhes: { ativoAnterior: empresa.ativo, ativoNovo: ativo },
        });
        return atualizada;
    }
    async atualizarUsuario(usuarioId, dto, superAdminId) {
        const usuario = await this.prisma.usuarioEmpresa.findUnique({
            where: { id: usuarioId },
        });
        if (!usuario)
            throw new common_1.NotFoundException('Usuário não encontrado');
        if (dto.email && dto.email !== usuario.email) {
            const existente = await this.prisma.usuarioEmpresa.findUnique({
                where: { email: dto.email },
            });
            if (existente)
                throw new common_1.ConflictException('E-mail já cadastrado para outro usuário');
        }
        const atualizado = await this.prisma.usuarioEmpresa.update({
            where: { id: usuarioId },
            data: { nome: dto.nome ?? undefined, email: dto.email ?? undefined },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                createdAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: 'USUARIO_ATUALIZADO_PELO_SUPER_ADMIN',
            entidade: 'UsuarioEmpresa',
            entidadeId: usuarioId,
            detalhes: {
                antes: { nome: usuario.nome, email: usuario.email },
                depois: dto,
            },
        });
        return atualizado;
    }
    async criarUsuarioParaGrupo(grupoId, dto, superAdminId) {
        const grupo = await this.prisma.grupo.findUnique({
            where: { id: grupoId },
        });
        if (!grupo)
            throw new common_1.NotFoundException('Grupo não encontrado');
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
                createdAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: 'USUARIO_EMPRESA_CRIADO_PELO_SUPER_ADMIN',
            entidade: 'UsuarioEmpresa',
            entidadeId: usuario.id,
            detalhes: { grupoId, papel: dto.papel, email: dto.email },
        });
        return usuario;
    }
    async atualizarStatusUsuarioGrupo(grupoId, usuarioId, dto, superAdminId) {
        const usuario = await this.prisma.usuarioEmpresa.findUnique({
            where: { id: usuarioId },
        });
        if (!usuario || usuario.grupoId !== grupoId) {
            throw new common_1.NotFoundException('Usuário não encontrado neste grupo');
        }
        const atualizado = await this.prisma.usuarioEmpresa.update({
            where: { id: usuarioId },
            data: { ativo: dto.ativo },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                telefoneWhatsapp: true,
                createdAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdminId,
            acao: dto.ativo
                ? 'USUARIO_EMPRESA_REATIVADO_PELO_SUPER_ADMIN'
                : 'USUARIO_EMPRESA_DESATIVADO_PELO_SUPER_ADMIN',
            entidade: 'UsuarioEmpresa',
            entidadeId: usuarioId,
        });
        return atualizado;
    }
};
exports.SuperAdminService = SuperAdminService;
exports.SuperAdminService = SuperAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SuperAdminService);
//# sourceMappingURL=super-admin.service.js.map