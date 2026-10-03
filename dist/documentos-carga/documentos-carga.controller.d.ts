import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { CreateDocumentoCargaDto } from './dto/create-documento-carga.dto';
import { DocumentosCargaService } from './documentos-carga.service';
export declare class DocumentosCargaController {
    private readonly service;
    constructor(service: DocumentosCargaService);
    upload(arquivo: Express.Multer.File | undefined, dto: CreateDocumentoCargaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        motoristaId: string | null;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        chaveAcesso: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
        entregueEm: Date | null;
        enderecoDestinatario: string | null;
        destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
        destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
        observacao: string | null;
    }>;
    list(user: UsuarioAutenticado, page?: string, pageSize?: string, ordem?: 'asc' | 'desc', tipo?: 'CTE' | 'MDFE', statusCarga?: 'CARREGADO' | 'VAZIO', motoristaId?: string, numero?: string, chaveAcesso?: string): Promise<{
        dados: {
            motorista: {
                nome: string;
            } | null;
            id: string;
            createdAt: Date;
            motoristaId: string | null;
            tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
            numero: string | null;
            chaveAcesso: string | null;
            statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
            entregueEm: Date | null;
            enderecoDestinatario: string | null;
            destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
            destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
            observacao: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    listByMotorista(motoristaId: string, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        chaveAcesso: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
        entregueEm: Date | null;
        enderecoDestinatario: string | null;
        destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
        destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
        observacao: string | null;
    }[]>;
    statusAtual(motoristaId: string, user: UsuarioAutenticado): Promise<{
        cteEmAberto: number;
        createdAt: Date;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
    } | {
        cteEmAberto: number;
        statusCarga: null;
    }>;
    remover(id: string, user: UsuarioAutenticado): Promise<{
        ok: boolean;
    }>;
    baixarXml(id: string, res: Response, user: UsuarioAutenticado, inline?: string): Promise<void>;
}
