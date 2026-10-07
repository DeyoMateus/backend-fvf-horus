import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AncoraIntegridadeService } from './ancora-integridade.service';
import { RegistrosJornadaService } from './registros-jornada.service';
export declare class MonitoramentoIntegridadeCadeiaService implements OnModuleInit, OnModuleDestroy {
    private readonly registrosJornada;
    private readonly ancora;
    private readonly logger;
    private timer;
    private emExecucao;
    constructor(registrosJornada: RegistrosJornadaService, ancora: AncoraIntegridadeService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private executar;
}
