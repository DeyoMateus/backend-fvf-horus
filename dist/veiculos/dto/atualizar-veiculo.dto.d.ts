import { TecnologiaRastreador } from '@prisma/client';
export declare class AtualizarVeiculoDto {
    placa: string;
    idRastreador?: string;
    tecnologiaRastreador?: TecnologiaRastreador;
}
