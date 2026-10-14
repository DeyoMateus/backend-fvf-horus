import { StatusSolicitacaoTitular, TipoDocumentoPrivacidade, TipoSolicitacaoTitular } from '@prisma/client';
export declare class RegistrarAceiteDto {
    tipoDocumento: TipoDocumentoPrivacidade;
    versao: string;
    aceitoLocalEm?: string;
}
export declare class CriarSolicitacaoTitularDto {
    tipo: TipoSolicitacaoTitular;
    descricao?: string;
}
export declare class ResponderSolicitacaoTitularDto {
    status: StatusSolicitacaoTitular;
    resposta: string;
}
export declare class AtualizarEncarregadoDto {
    nome?: string;
    email?: string;
    telefone?: string;
}
