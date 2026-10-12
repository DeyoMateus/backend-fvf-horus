import { AuditService } from '../audit/audit.service';
export interface UsuarioParaLocalizacao {
    sub: string;
    papel: string;
}
export type OrigemConsultaLocalizacao = 'LISTA_REGISTROS' | 'ANALISE_INTEGRIDADE' | 'AEJ' | 'COMPROVANTE' | 'ESPELHO_REP_P' | 'HOLERITE';
export declare class LocalizacaoAcessoService {
    private readonly audit;
    private readonly ultimas;
    constructor(audit: AuditService);
    filtrar<T>(usuario: UsuarioParaLocalizacao, motoristaId: string, origem: OrigemConsultaLocalizacao, dados: T, contexto?: {
        ip?: string | null;
        userAgent?: string | null;
    }): Promise<T>;
    private auditar;
}
