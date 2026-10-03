import { PapelUsuario } from '@prisma/client';
export declare class CreateUsuarioGrupoDto {
    nome: string;
    email: string;
    senha: string;
    papel: PapelUsuario;
    telefoneWhatsapp?: string;
}
