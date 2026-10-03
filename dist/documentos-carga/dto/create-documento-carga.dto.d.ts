import { TipoDocumentoCarga, StatusCargaViagem } from '@prisma/client';
export declare class CreateDocumentoCargaDto {
    tipo: TipoDocumentoCarga;
    statusCarga: StatusCargaViagem;
    motoristaId?: string;
    empresaId?: string;
    numero?: string;
    chaveAcesso?: string;
    observacao?: string;
}
