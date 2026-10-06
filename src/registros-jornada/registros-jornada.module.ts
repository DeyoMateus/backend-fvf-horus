import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AejModule } from '../common/aej/aej.module';
import { AntifraudeModule } from '../common/antifraude/antifraude.module';
import { ComprovanteModule } from '../common/comprovante/comprovante.module';
import { JornadaLegalModule } from '../common/jornada-legal/jornada-legal.module';
import { RepPModule } from '../common/rep-p/rep-p.module';
import { FeriadosModule } from '../feriados/feriados.module';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';
import { MonitoramentoIntegridadeCadeiaService } from './monitoramento-integridade-cadeia.service';
import { MonitoramentoJornadaAbertaService } from './monitoramento-jornada-aberta.service';
import { RegistrosJornadaController } from './registros-jornada.controller';
import { RegistrosJornadaService } from './registros-jornada.service';
import { FILA_VERIFICACAO_JORNADA } from './verificacao-agendada.constants';
import { FILA_LOTE_REGISTROS_JORNADA } from './lote-registros-jornada.constants';
import { LoteRegistrosJornadaProcessor } from './lote-registros-jornada.processor';
import { VerificacaoJornadaAgendadaProcessor } from './verificacao-agendada.processor';
import { VerificacaoJornadaAgendadaService } from './verificacao-agendada.service';

@Module({
  imports: [
    JornadaLegalModule,
    AntifraudeModule,
    PushNotificationsModule,
    ComprovanteModule,
    AejModule,
    RepPModule,
    FeriadosModule,
    // Fila do agendamento por motorista (Rodada 21) , registrada aqui
    // (não num módulo próprio) de propósito: o processor injeta
    // RegistrosJornadaService, e RegistrosJornadaService injeta o
    // produtor (VerificacaoJornadaAgendadaService) , os três moram no
    // mesmo módulo pra essa dependência circular de classes nunca virar
    // uma dependência circular de MÓDULOS (que exigiria forwardRef).
    BullModule.registerQueue({ name: FILA_VERIFICACAO_JORNADA }),
    // Fila de processamento de lotes de ponto (Rodada 66) , mesmo
    // raciocínio de módulo único do comentário acima: o processor
    // injeta RegistrosJornadaService.
    BullModule.registerQueue({ name: FILA_LOTE_REGISTROS_JORNADA }),
  ],
  controllers: [RegistrosJornadaController],
  providers: [
    RegistrosJornadaService,
    MonitoramentoJornadaAbertaService,
    MonitoramentoIntegridadeCadeiaService,
    VerificacaoJornadaAgendadaService,
    VerificacaoJornadaAgendadaProcessor,
    LoteRegistrosJornadaProcessor,
  ],
  exports: [RegistrosJornadaService],
})
export class RegistrosJornadaModule {}
