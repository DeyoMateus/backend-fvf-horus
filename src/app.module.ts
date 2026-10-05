import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bullmq';
import { AlertasJornadaModule } from './alertas-jornada/alertas-jornada.module';
import { AuditModule } from './common/audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { HashChainModule } from './common/hash-chain/hash-chain.module';
import { StorageModule } from './common/storage/storage.module';
import { EmailModule } from './common/email/email.module';
import { AccountLockoutModule } from './common/account-lockout/account-lockout.module';
import { GeocodingModule } from './common/geocoding/geocoding.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantModule } from './common/tenant/tenant.module';
import { SignatureModule } from './common/signature/signature.module';
import { AuthModule } from './auth/auth.module';
import { AutorrelatoFolgaModule } from './autorrelato-folga/autorrelato-folga.module';
import { DispositivosModule } from './dispositivos/dispositivos.module';
import { DocumentosCargaModule } from './documentos-carga/documentos-carga.module';
import { EmpresasModule } from './empresas/empresas.module';
import { FolgaConcedidaModule } from './folga-concedida/folga-concedida.module';
import { MotoristasModule } from './motoristas/motoristas.module';
import { VeiculosModule } from './veiculos/veiculos.module';
import { RegistrosJornadaModule } from './registros-jornada/registros-jornada.module';
import { TratamentosPontoModule } from './tratamentos-ponto/tratamentos-ponto.module';
import { AmostrasLocalizacaoModule } from './amostras-localizacao/amostras-localizacao.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HoleriteModule } from './holerite/holerite.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { BancoHorasModule } from './banco-horas/banco-horas.module';
import { RegrasSindicaisModule } from './regras-sindicais/regras-sindicais.module';
import { FeriadosModule } from './feriados/feriados.module';
import { SolicitacoesAjustePontoModule } from './solicitacoes-ajuste-ponto/solicitacoes-ajuste-ponto.module';
import { UsuariosEmpresaModule } from './usuarios-empresa/usuarios-empresa.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AjudantesModule } from './ajudantes/ajudantes.module';
import { RegistrosJornadaAjudanteModule } from './registros-jornada-ajudante/registros-jornada-ajudante.module';
import { DossieCobrancaModule } from './dossie-cobranca/dossie-cobranca.module';
import { FechamentoFiscalModule } from './fechamento-fiscal/fechamento-fiscal.module';
import { LimpezaTokensModule } from './common/limpeza-tokens/limpeza-tokens.module';
import { RedisThrottlerStorageService } from './common/throttler/redis-throttler-storage.service';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';
import { FusoClienteInterceptor } from './common/fuso/fuso-cliente.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global (defesa contra brute force / DoS de aplicação).
    // Endpoints sensíveis (login) sobrescrevem com limites mais estritos via @Throttle.
    ThrottlerModule.forRootAsync({
      imports: [],
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 60 }],
        // Storage no Redis (não o Map em memória padrão) , necessário pra
        // o limite valer de fato quando a API escalar pra mais de uma
        // instância atrás de um load balancer (meta de "milhares de
        // requisições simultâneas", item 4 do roadmap).
        storage: new RedisThrottlerStorageService(),
      }),
    }),
    // Conexão única com o Redis para todas as filas BullMQ do app
    // (hoje só notificações push; dá pra crescer pra outros jobs
    // assíncronos sem duplicar conexão).
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    PrismaModule,
    TenantModule,
    StorageModule,
    EmailModule,
    AccountLockoutModule,
    GeocodingModule,
    CryptoModule,
    HashChainModule,
    SignatureModule,
    AuditModule,
    AuthModule,
    EmpresasModule,
    MotoristasModule,
    VeiculosModule,
    DispositivosModule,
    RegistrosJornadaModule,
    TratamentosPontoModule,
    AlertasJornadaModule,
    AutorrelatoFolgaModule,
    FolgaConcedidaModule,
    DocumentosCargaModule,
    AmostrasLocalizacaoModule,
    DashboardModule,
    HoleriteModule,
    IndicadoresModule,
    BancoHorasModule,
    RegrasSindicaisModule,
    FeriadosModule,
    SolicitacoesAjustePontoModule,
    UsuariosEmpresaModule,
    SuperAdminModule,
    AuditoriaModule,
    AjudantesModule,
    RegistrosJornadaAjudanteModule,
    DossieCobrancaModule,
    FechamentoFiscalModule,
    LimpezaTokensModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Estabelece o grupo (tenant) do Row-Level Security (Rodada 23) para
    // toda requisição, antes de qualquer controller/service tocar o
    // Prisma , ver tenant-context.interceptor.ts.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    // Rodada 148: aprende o fuso do computador do gestor (WhatsApp por fuso).
    { provide: APP_INTERCEPTOR, useClass: FusoClienteInterceptor },
  ],
})
export class AppModule {}
