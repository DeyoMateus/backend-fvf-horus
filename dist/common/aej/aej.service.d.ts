import type { Motorista, RegistroJornada } from '@prisma/client';
import type { EmpresaDoComprovante } from '../comprovante/comprovante.service';
export declare class AejService {
    gerarCsv(motorista: Motorista, empresa: EmpresaDoComprovante, registros: RegistroJornada[]): string;
    private escaparCampo;
}
