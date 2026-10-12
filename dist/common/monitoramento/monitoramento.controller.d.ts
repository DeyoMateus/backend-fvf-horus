import { MonitoramentoOperacionalService } from './monitoramento-operacional.service';
export declare class MonitoramentoController {
    private readonly monitoramento;
    constructor(monitoramento: MonitoramentoOperacionalService);
    completo(): Promise<{
        status: string;
        verificadoEm: string;
        verificacoes: {
            [k: string]: string;
        };
    }>;
}
