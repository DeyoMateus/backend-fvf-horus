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
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tenant_context_1 = require("../tenant/tenant-context");
const MODELOS_COM_RLS = [
    'grupo',
    'empresa',
    'usuarioEmpresa',
    'refreshToken',
    'motorista',
    'dispositivoVinculado',
    'veiculoVinculado',
    'amostraLocalizacao',
    'registroJornada',
    'tratamentoPonto',
    'alertaJornada',
    'solicitacaoTrocaDispositivo',
    'autorrelatoFolga',
    'folgaConcedida',
    'documentoCarga',
    'tratamentoPontoEvidencia',
    'regraSindical',
    'solicitacaoAjustePonto',
    'solicitacaoAjustePontoEvidencia',
    'feriado',
    'passwordResetToken',
    'ajusteBancoHoras',
    'ajudante',
    'dispositivoVinculadoAjudante',
    'registroJornadaAjudante',
    'amostraHoraConfiavel',
    'verificacaoRelogioPendente',
];
const OPERACOES_INTERCEPTADAS = [
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'findUnique',
    'findUniqueOrThrow',
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'count',
    'aggregate',
    'groupBy',
];
let PrismaService = class PrismaService extends client_1.PrismaClient {
    cru;
    transactionOriginal;
    executeRawUnsafeOriginal;
    constructor() {
        super();
        this.transactionOriginal = this.$transaction.bind(this);
        this.executeRawUnsafeOriginal = this.$executeRawUnsafe.bind(this);
        const cru = {};
        for (const nomeModelo of MODELOS_COM_RLS) {
            const delegadoOriginal = this[nomeModelo];
            if (!delegadoOriginal)
                continue;
            cru[nomeModelo] = delegadoOriginal;
            const proxy = new Proxy(delegadoOriginal, {
                get: (target, prop) => {
                    const original = target[prop];
                    if (typeof original !== 'function' ||
                        !OPERACOES_INTERCEPTADAS.includes(prop)) {
                        return original;
                    }
                    return (...args) => this.executarComRls(`${nomeModelo}.${prop}`, () => original.apply(target, args));
                },
            });
            Object.defineProperty(this, nomeModelo, {
                value: proxy,
                configurable: true,
                enumerable: true,
            });
        }
        this.cru = cru;
        const rawQueryRaw = this.$queryRaw.bind(this);
        const rawQueryRawUnsafe = this.$queryRawUnsafe.bind(this);
        const rawExecuteRaw = this.$executeRaw.bind(this);
        Object.defineProperty(this, '$queryRaw', {
            value: (...args) => this.executarComRls('$queryRaw', () => rawQueryRaw(...args)),
            configurable: true,
        });
        Object.defineProperty(this, '$queryRawUnsafe', {
            value: (...args) => this.executarComRls('$queryRawUnsafe', () => rawQueryRawUnsafe(...args)),
            configurable: true,
        });
        Object.defineProperty(this, '$executeRaw', {
            value: (...args) => this.executarComRls('$executeRaw', () => rawExecuteRaw(...args)),
            configurable: true,
        });
    }
    async executarComRls(nomeOperacao, chamar) {
        const ctx = tenant_context_1.TenantContext.atual();
        if (!ctx) {
            throw new Error(`Acesso a "${nomeOperacao}" sem contexto de tenant definido. Toda leitura/escrita nas tabelas ` +
                'protegidas por Row-Level Security precisa rodar dentro do TenantContextInterceptor (requisição ' +
                'HTTP) ou de TenantContext.paraSistema() (job interno). Ver ' +
                'claude/arquitetura-seguranca-controle-jornada.md, Rodada 23.');
        }
        const grupoEscapado = ctx.grupoId.replace(/'/g, "''");
        const [, resultado] = await this.transactionOriginal([
            this.executeRawUnsafeOriginal(`SET LOCAL app.grupo_atual = '${grupoEscapado}'`),
            chamar(),
        ]);
        return resultado;
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map