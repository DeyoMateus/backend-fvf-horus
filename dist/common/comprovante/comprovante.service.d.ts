import type { Motorista, RegistroJornada } from '@prisma/client';
export interface EmpresaDoComprovante {
    razaoSocial: string;
    cnpj: string;
}
export declare class ComprovanteService {
    gerarPdfRegistros(motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh' | 'hashGenesis'>, empresa: EmpresaDoComprovante, registros: RegistroJornada[], periodoInicio: Date, periodoFim: Date): Promise<Buffer>;
}
