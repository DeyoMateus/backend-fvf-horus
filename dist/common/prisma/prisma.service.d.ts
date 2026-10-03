import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
declare const MODELOS_COM_RLS: readonly ["grupo", "empresa", "usuarioEmpresa", "refreshToken", "motorista", "dispositivoVinculado", "veiculoVinculado", "amostraLocalizacao", "registroJornada", "tratamentoPonto", "alertaJornada", "solicitacaoTrocaDispositivo", "autorrelatoFolga", "folgaConcedida", "documentoCarga", "tratamentoPontoEvidencia", "regraSindical", "solicitacaoAjustePonto", "solicitacaoAjustePontoEvidencia", "feriado", "passwordResetToken", "ajusteBancoHoras", "ajudante", "dispositivoVinculadoAjudante", "registroJornadaAjudante", "amostraHoraConfiavel", "verificacaoRelogioPendente"];
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    readonly cru: Pick<PrismaClient, (typeof MODELOS_COM_RLS)[number]>;
    private readonly transactionOriginal;
    private readonly executeRawUnsafeOriginal;
    constructor();
    private executarComRls;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
export {};
