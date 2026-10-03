import { TipoEvento } from '@prisma/client';
export declare class CreateSolicitacaoAjusteDto {
    tipoEvento: TipoEvento;
    timestampEvento: string;
    justificativa: string;
    registroReferenciaId?: string;
}
