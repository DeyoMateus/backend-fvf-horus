import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RegistrosJornadaService } from './registros-jornada.service';

/**
 * Dispara `RegistrosJornadaService.verificarJornadasAbertasProativamente`
 * periodicamente (Rodada 19) , é o que faz o motor de limites legais
 * (direção contínua, jornada de direção, espera) rodar mesmo quando o
 * motorista não registra NENHUM evento novo por horas. Antes desta
 * rodada, o motor só era chamado dentro da transação de `create()`,
 * então "motorista dirigindo continuamente há 7h30" nunca gerava
 * alerta nenhum, pro motorista ou pro gestor, se ele simplesmente não
 * apertasse mais nada no app.
 *
 * Implementado com `setInterval` puro (`OnModuleInit`/`OnModuleDestroy`),
 * não com `@nestjs/schedule` , decisão deliberada pra não adicionar
 * dependência nova neste ambiente específico, onde `npm install` de
 * pacotes novos já deu problema reincidente (OneDrive/antivírus
 * segurando arquivo, ver Rodada 4/6). Semanticamente equivalente a um
 * `@Cron`/repetição de fila: um único timer, com trava simples contra
 * sobreposição (`emExecucao`) pro caso de a varredura de uma vez levar
 * mais que o intervalo entre elas.
 *
 * Rodada 20 , decisão explícita do usuário: o cálculo fica só aqui no
 * servidor (não replicado dentro do app do motorista), justamente pra
 * não gastar bateria do telefone recalculando os limites o tempo
 * todo. O intervalo passou de 10min pra 30min por pedido dele , ainda
 * roda uma vez assim que o backend sobe, e agora notifica tanto quando
 * a jornada está PRÓXIMA de estourar (severidade ATENCAO) quanto
 * quando já ESTOUROU (CRITICO), não só o segundo caso.
 *
 * Rodada 21 , deixou de ser o mecanismo PRINCIPAL de detecção: agora é
 * uma rede de segurança. O caminho principal é
 * `VerificacaoJornadaAgendadaService`, que agenda um job por motorista
 * exatamente na hora em que ele cruzaria o próximo limiar (em vez de
 * escanear todo mundo com jornada aberta a cada ciclo, o que não
 * escala pra uma base de motoristas grande). Esta varredura continua
 * existindo pra cobrir os casos em que esse job se perde por algum
 * motivo (Redis zerado, bug na hora de agendar, motorista com jornada
 * que já estava aberta antes desta rodada e nunca ganhou um job) , ao
 * encontrar um desses, `verificarEAgendarProximoMotorista` já
 * reagenda o motorista pelo caminho novo, então o mesmo motorista não
 * deveria continuar precisando desta varredura nos ciclos seguintes.
 *
 * Desligado em ambiente de teste (`NODE_ENV === 'test'`) pra não
 * disparar timers reais/chamadas ao banco durante `npm test`.
 */
@Injectable()
export class MonitoramentoJornadaAbertaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MonitoramentoJornadaAbertaService.name);
  private timer: NodeJS.Timeout | null = null;
  private emExecucao = false;

  constructor(private readonly registrosJornada: RegistrosJornadaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const intervaloMs = Number(
      process.env.INTERVALO_VERIFICACAO_JORNADA_ABERTA_MS ?? 30 * 60 * 1000,
    ); // 30min por padrão (Rodada 20)
    this.timer = setInterval(() => void this.executar(), intervaloMs);
    // Não espera o primeiro intervalo inteiro pra rodar a primeira vez ,
    // um motorista já estourado no momento em que o backend sobe não
    // deveria esperar até 10min pro primeiro alerta subir.
    void this.executar();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async executar() {
    if (this.emExecucao) return; // trava contra sobreposição se a varredura anterior ainda não terminou
    this.emExecucao = true;
    try {
      const quantidade =
        await this.registrosJornada.verificarJornadasAbertasProativamente();
      // Rodada 68 , log de sucesso, não só de falha: sem isto não
      // havia como confirmar pelo terminal que a varredura de
      // segurança está de fato rodando a cada ciclo (só se via warn
      // quando dava erro) , um "alerta não chegou" ficava impossível
      // de diferenciar de "a varredura nunca roda de verdade".
      this.logger.log(
        `Varredura de jornadas abertas concluída: ${quantidade} motorista(s) com jornada aberta avaliado(s).`,
      );
    } catch (err) {
      // Fail-open: um erro aqui nunca pode derrubar o processo do backend.
      this.logger.warn(
        `Falha na verificação proativa de jornadas abertas: ${(err as Error).message}`,
      );
    } finally {
      this.emExecucao = false;
    }
  }
}
