import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  FILA_LOTE_REGISTROS_JORNADA,
  JobLoteRegistroJornada,
  ResultadoItemLote,
} from './lote-registros-jornada.constants';
import { RegistrosJornadaService } from './registros-jornada.service';

/**
 * Consome a fila de lotes de ponto (Rodada 66). `concurrency: 10`
 * limita quantos lotes são processados ao mesmo tempo neste worker ,
 * é a peça que faz "milhares de envios simultâneos" não virarem
 * "milhares de transações simultâneas no Postgres": o excesso de
 * requisições HTTP simplesmente espera na fila (cada uma já enfileirou
 * seu job e está bloqueada em `waitUntilFinished`), sem represar o
 * banco. Ajustável via variável de ambiente sem precisar de deploy de
 * código novo, caso a capacidade real do banco em produção peça outro
 * número.
 */
@Processor(FILA_LOTE_REGISTROS_JORNADA, {
  concurrency: Number(process.env.CONCORRENCIA_FILA_LOTE_PONTO ?? 10),
})
export class LoteRegistrosJornadaProcessor extends WorkerHost {
  private readonly logger = new Logger(LoteRegistrosJornadaProcessor.name);

  constructor(
    private readonly registrosJornada: RegistrosJornadaService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<JobLoteRegistroJornada>,
  ): Promise<ResultadoItemLote[]> {
    const { motoristaId, deviceUuid, eventos, ip, userAgent } = job.data;

    // O worker roda fora de qualquer requisição HTTP , não há
    // TenantContextInterceptor aqui. Precisa do grupoId real do
    // motorista (não SISTEMA) porque `create()` faz SET LOCAL
    // app.grupo_atual usando o contexto ativo (RLS , Rodada 23), e
    // esta operação NUNCA deveria enxergar outro grupo.
    const motorista = await TenantContext.paraSistema(() =>
      this.prisma.motorista.findUnique({
        where: { id: motoristaId },
        select: { empresa: { select: { grupoId: true } } },
      }),
    );
    if (!motorista) {
      // Motorista pode ter sido excluído entre o envio do lote e o
      // processamento , cada item vira "falha", nunca uma exceção que
      // derruba o worker.
      return eventos.map((_, index) => ({
        index,
        sucesso: false,
        erro: 'Motorista não encontrado',
      }));
    }

    return TenantContext.paraGrupo(motorista.empresa.grupoId, () =>
      this.registrosJornada.processarLoteSequencial(
        motoristaId,
        deviceUuid,
        eventos,
        ip,
        userAgent,
      ),
    );
  }
}
