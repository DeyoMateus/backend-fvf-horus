"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const bullmq_1 = require("@nestjs/bullmq");
const alertas_jornada_module_1 = require("./alertas-jornada/alertas-jornada.module");
const audit_module_1 = require("./common/audit/audit.module");
const crypto_module_1 = require("./common/crypto/crypto.module");
const hash_chain_module_1 = require("./common/hash-chain/hash-chain.module");
const storage_module_1 = require("./common/storage/storage.module");
const email_module_1 = require("./common/email/email.module");
const account_lockout_module_1 = require("./common/account-lockout/account-lockout.module");
const geocoding_module_1 = require("./common/geocoding/geocoding.module");
const prisma_module_1 = require("./common/prisma/prisma.module");
const tenant_module_1 = require("./common/tenant/tenant.module");
const signature_module_1 = require("./common/signature/signature.module");
const auth_module_1 = require("./auth/auth.module");
const autorrelato_folga_module_1 = require("./autorrelato-folga/autorrelato-folga.module");
const dispositivos_module_1 = require("./dispositivos/dispositivos.module");
const documentos_carga_module_1 = require("./documentos-carga/documentos-carga.module");
const empresas_module_1 = require("./empresas/empresas.module");
const folga_concedida_module_1 = require("./folga-concedida/folga-concedida.module");
const motoristas_module_1 = require("./motoristas/motoristas.module");
const veiculos_module_1 = require("./veiculos/veiculos.module");
const registros_jornada_module_1 = require("./registros-jornada/registros-jornada.module");
const tratamentos_ponto_module_1 = require("./tratamentos-ponto/tratamentos-ponto.module");
const amostras_localizacao_module_1 = require("./amostras-localizacao/amostras-localizacao.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const holerite_module_1 = require("./holerite/holerite.module");
const indicadores_module_1 = require("./indicadores/indicadores.module");
const banco_horas_module_1 = require("./banco-horas/banco-horas.module");
const regras_sindicais_module_1 = require("./regras-sindicais/regras-sindicais.module");
const feriados_module_1 = require("./feriados/feriados.module");
const solicitacoes_ajuste_ponto_module_1 = require("./solicitacoes-ajuste-ponto/solicitacoes-ajuste-ponto.module");
const usuarios_empresa_module_1 = require("./usuarios-empresa/usuarios-empresa.module");
const super_admin_module_1 = require("./super-admin/super-admin.module");
const auditoria_module_1 = require("./auditoria/auditoria.module");
const ajudantes_module_1 = require("./ajudantes/ajudantes.module");
const registros_jornada_ajudante_module_1 = require("./registros-jornada-ajudante/registros-jornada-ajudante.module");
const dossie_cobranca_module_1 = require("./dossie-cobranca/dossie-cobranca.module");
const fechamento_fiscal_module_1 = require("./fechamento-fiscal/fechamento-fiscal.module");
const limpeza_tokens_module_1 = require("./common/limpeza-tokens/limpeza-tokens.module");
const redis_throttler_storage_service_1 = require("./common/throttler/redis-throttler-storage.service");
const tenant_context_interceptor_1 = require("./common/tenant/tenant-context.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRootAsync({
                imports: [],
                useFactory: () => ({
                    throttlers: [{ ttl: 60_000, limit: 60 }],
                    storage: new redis_throttler_storage_service_1.RedisThrottlerStorageService(),
                }),
            }),
            bullmq_1.BullModule.forRootAsync({
                useFactory: () => ({
                    connection: {
                        host: process.env.REDIS_HOST ?? 'localhost',
                        port: Number(process.env.REDIS_PORT ?? 6379),
                    },
                }),
            }),
            prisma_module_1.PrismaModule,
            tenant_module_1.TenantModule,
            storage_module_1.StorageModule,
            email_module_1.EmailModule,
            account_lockout_module_1.AccountLockoutModule,
            geocoding_module_1.GeocodingModule,
            crypto_module_1.CryptoModule,
            hash_chain_module_1.HashChainModule,
            signature_module_1.SignatureModule,
            audit_module_1.AuditModule,
            auth_module_1.AuthModule,
            empresas_module_1.EmpresasModule,
            motoristas_module_1.MotoristasModule,
            veiculos_module_1.VeiculosModule,
            dispositivos_module_1.DispositivosModule,
            registros_jornada_module_1.RegistrosJornadaModule,
            tratamentos_ponto_module_1.TratamentosPontoModule,
            alertas_jornada_module_1.AlertasJornadaModule,
            autorrelato_folga_module_1.AutorrelatoFolgaModule,
            folga_concedida_module_1.FolgaConcedidaModule,
            documentos_carga_module_1.DocumentosCargaModule,
            amostras_localizacao_module_1.AmostrasLocalizacaoModule,
            dashboard_module_1.DashboardModule,
            holerite_module_1.HoleriteModule,
            indicadores_module_1.IndicadoresModule,
            banco_horas_module_1.BancoHorasModule,
            regras_sindicais_module_1.RegrasSindicaisModule,
            feriados_module_1.FeriadosModule,
            solicitacoes_ajuste_ponto_module_1.SolicitacoesAjustePontoModule,
            usuarios_empresa_module_1.UsuariosEmpresaModule,
            super_admin_module_1.SuperAdminModule,
            auditoria_module_1.AuditoriaModule,
            ajudantes_module_1.AjudantesModule,
            registros_jornada_ajudante_module_1.RegistrosJornadaAjudanteModule,
            dossie_cobranca_module_1.DossieCobrancaModule,
            fechamento_fiscal_module_1.FechamentoFiscalModule,
            limpeza_tokens_module_1.LimpezaTokensModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: tenant_context_interceptor_1.TenantContextInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map