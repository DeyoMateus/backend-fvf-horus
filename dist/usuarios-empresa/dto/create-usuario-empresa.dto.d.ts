import { PapelUsuario } from '@prisma/client';
export declare class CreateUsuarioEmpresaDto {
    nome: string;
    email: string;
    senha: string;
    papel: PapelUsuario;
    telefoneWhatsapp?: string;
}
