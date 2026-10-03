import { TipoAjusteBancoHoras } from '@prisma/client';
export declare class CriarAjusteBancoHorasDto {
    tipo: TipoAjusteBancoHoras;
    minutos: number;
    data: string;
    observacao?: string;
}
