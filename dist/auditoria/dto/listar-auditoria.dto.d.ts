import { ActorType } from '@prisma/client';
export declare class ListarAuditoriaDto {
    page?: number;
    pageSize?: number;
    actorType?: ActorType;
    acoes?: string[];
    entidade?: string;
    entidadeId?: string;
    dataInicio?: string;
    dataFim?: string;
    ordem?: 'asc' | 'desc';
    grupoId?: string;
}
