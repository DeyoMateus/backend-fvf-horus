import type { Motorista } from '@prisma/client';
import type { EmpresaDoComprovante } from '../common/comprovante/comprovante.service';
import type { ResultadoHolerite } from './holerite.service';
export declare function gerarPdfHolerite(motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>, empresa: EmpresaDoComprovante, resultado: ResultadoHolerite): Promise<Buffer>;
export interface ItemFechamentoLote {
    motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>;
    empresa: EmpresaDoComprovante;
    resultado: ResultadoHolerite;
}
export declare function gerarPdfFechamentoLote(itens: ItemFechamentoLote[], periodoInicio: Date, periodoFim: Date): Promise<Buffer>;
