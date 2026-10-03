import { TecnologiaRastreador } from '@prisma/client';
export declare class CreateMotoristaDto {
    nome: string;
    cpf: string;
    cnh: string;
    empresaId: string;
    placa?: string;
    idRastreador?: string;
    tecnologiaRastreador?: TecnologiaRastreador;
    telefone: string;
}
