import type { Motorista, RegistroJornada, RegraSindical, TratamentoPonto } from '@prisma/client';
import { NsrService } from '../nsr/nsr.service';
interface EmpresaDoRelatorio {
    razaoSocial: string;
    cnpj: string;
    fusoHorario?: string | null;
}
export interface FeriadoDoRelatorio {
    data: string;
    descricao: string;
    pagoComoDomingo: boolean;
}
type TratamentoComUsuario = TratamentoPonto & {
    usuario: {
        nome: string;
    };
};
export interface RepPOpcoes {
    periodoInicio: Date;
    periodoFim: Date;
}
export declare class RepPService {
    private readonly nsr;
    constructor(nsr: NsrService);
    gerarPdf(motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh' | 'hashGenesis' | 'certificadoFingerprint'>, empresa: EmpresaDoRelatorio, regraSindical: RegraSindical | null, registrosEntrada: RegistroJornada[], tratamentosEntrada: TratamentoComUsuario[], feriadosNoPeriodo: FeriadoDoRelatorio[], opcoes: RepPOpcoes, deviceUuidAtual: string | null): Promise<Buffer>;
    private escreverCabecalho;
    private escreverTabelaEventos;
    private escreverResumosDiarios;
    private escreverAjustesRh;
    private escreverRodape;
    private resumirDia;
    private calcularDescansoInterjornada;
    private somarPedacosDoDia;
    private somarIntervalosNoDia;
    private construirIntervalosCompletos;
    private minutosEntre;
    private chaveDia;
    private formatarDiaBr;
    private formatarHoras;
}
export {};
