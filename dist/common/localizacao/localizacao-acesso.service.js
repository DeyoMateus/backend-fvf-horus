"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalizacaoAcessoService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const localizacao_acesso_util_1 = require("./localizacao-acesso.util");
const JANELA_DEDUPE_MS = 5 * 60 * 1000;
let LocalizacaoAcessoService = class LocalizacaoAcessoService {
    audit;
    ultimas = new Map();
    constructor(audit) {
        this.audit = audit;
    }
    async filtrar(usuario, motoristaId, origem, dados, contexto) {
        if (!(0, localizacao_acesso_util_1.podeVerLocalizacao)(usuario.papel)) {
            return (0, localizacao_acesso_util_1.removerCoordenadas)(dados);
        }
        await this.auditar(usuario, motoristaId, origem, contexto);
        return dados;
    }
    async auditar(usuario, motoristaId, origem, contexto) {
        const agora = Date.now();
        const chave = `${usuario.sub}|${motoristaId}|${origem}`;
        const anterior = this.ultimas.get(chave);
        if (anterior !== undefined && agora - anterior < JANELA_DEDUPE_MS)
            return;
        this.ultimas.set(chave, agora);
        if (this.ultimas.size > 5000) {
            for (const [k, t] of this.ultimas) {
                if (agora - t >= JANELA_DEDUPE_MS)
                    this.ultimas.delete(k);
            }
        }
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuario.sub,
            acao: 'LOCALIZACAO_CONSULTADA',
            entidade: 'Motorista',
            entidadeId: motoristaId,
            detalhes: { origem },
            ip: contexto?.ip ?? null,
            userAgent: contexto?.userAgent ?? null,
        });
    }
};
exports.LocalizacaoAcessoService = LocalizacaoAcessoService;
exports.LocalizacaoAcessoService = LocalizacaoAcessoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], LocalizacaoAcessoService);
//# sourceMappingURL=localizacao-acesso.service.js.map