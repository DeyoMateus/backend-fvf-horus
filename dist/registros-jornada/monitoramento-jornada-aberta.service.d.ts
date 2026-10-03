import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RegistrosJornadaService } from './registros-jornada.service';
export declare class MonitoramentoJornadaAbertaService implements OnModuleInit, OnModuleDestroy {
    private readonly registrosJornada;
    private readonly logger;
    private timer;
    private emExecucao;
    constructor(registrosJornada: RegistrosJornadaService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private executar;
}
