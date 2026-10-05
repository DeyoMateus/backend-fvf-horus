import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Motorista } from '@prisma/client';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { HoleriteService } from '../holerite/holerite.service';
import { AtualizarPerfilMotoristaDto } from './dto/atualizar-perfil-motorista.dto';
import { MotoristasService } from './motoristas.service';
import { paraParedeBrt } from '../common/fuso/fuso-brasil.util';

type RequisicaoMotorista = { motorista: Motorista; grupoId: string };

// Rodada 144: "mês atual" é o mês civil de Brasília (às 22h BRT do último
// dia do mês o servidor já está em UTC no mês seguinte). O valor devolvido
// é "só data" (meia-noite UTC do dia 1), que o holerite converte em 00:00 BRT.
function inicioDoMes(agora: Date): Date {
  const p = paraParedeBrt(agora);
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 1, 0, 0, 0));
}

/**
 * Pedido do usuário: "deixe apenas as horas totais do motorista do mês
 * vigente, tendo a possibilidade de buscar os resultados de meses
 * anteriores". Resolve `ano`/`mes` (1-12) da query pro início do mês
 * pedido , nunca deixa ir além do mês atual (mês futuro não existe
 * registro nenhum pra mostrar, cairia num período vazio sem sentido).
 */
function resolverInicioMesSolicitado(
  agora: Date,
  anoQuery?: string,
  mesQuery?: string,
): Date {
  const inicioMesAtual = inicioDoMes(agora);
  if (!anoQuery && !mesQuery) return inicioMesAtual;

  const agoraBrt = paraParedeBrt(agora);
  const ano = anoQuery ? Number(anoQuery) : agoraBrt.getUTCFullYear();
  const mes = mesQuery ? Number(mesQuery) : agoraBrt.getUTCMonth() + 1; // 1-12
  if (
    !Number.isFinite(ano) ||
    !Number.isFinite(mes) ||
    mes < 1 ||
    mes > 12
  ) {
    return inicioMesAtual;
  }

  const inicioSolicitado = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  return inicioSolicitado.getTime() > inicioMesAtual.getTime()
    ? inicioMesAtual
    : inicioSolicitado;
}

/**
 * Último DIA do mês que começa em `inicioMes`, como "só data" (meia-noite
 * UTC); o holerite estende para 23:59:59.999 BRT desse dia.
 */
function fimDoMes(inicioMes: Date): Date {
  return new Date(
    Date.UTC(inicioMes.getUTCFullYear(), inicioMes.getUTCMonth() + 1, 0, 0, 0, 0),
  );
}

/**
 * Usado pelo PRÓPRIO app do motorista (device binding) , mesmo padrão
 * de `DispositivosMobileController`/`AlertasJornadaMobileController`.
 * Rodada 39: "Meu perfil" (ver/editar nome, telefone, e-mail , nunca
 * CPF) e "Minhas horas" (acompanhamento pessoal do que já trabalhou no
 * mês e, se a empresa usar banco de horas, o saldo do mês e o saldo
 * total desde a admissão).
 */
@Controller('dispositivo')
@UseGuards(MotoristaDeviceGuard)
export class MotoristasMobileController {
  constructor(
    private readonly motoristasService: MotoristasService,
    private readonly holerite: HoleriteService,
    private readonly bancoHoras: BancoHorasService,
  ) {}

  @Get('meu-perfil')
  obterMeuPerfil(@Req() req: RequisicaoMotorista) {
    return this.motoristasService.obterPerfilProprio(req.motorista.id);
  }

  @Patch('meu-perfil')
  atualizarMeuPerfil(
    @Req() req: RequisicaoMotorista,
    @Body() dto: AtualizarPerfilMotoristaDto,
  ) {
    return this.motoristasService.atualizarPerfilProprio(req.motorista.id, dto);
  }

  /**
   * "Minhas horas": direção/espera/extra/noturno do mês corrente (o
   * app do motorista não tem filtro de período, sempre "o mês até
   * hoje" , mesmo espírito de simplicidade do painel do gestor) e,
   * quando a empresa usa banco de horas, o saldo do mês e o saldo
   * TOTAL desde a admissão dele (`motorista.createdAt`) , diferente do
   * painel do gestor (Indicadores/BancoHorasController), que só olha o
   * saldo dentro do período escolhido a cada consulta: aqui, "saldo
   * total" é justamente o que o motorista quer ver, então soma-se
   * desde que ele foi cadastrado.
   */
  @Get('minhas-horas')
  async minhasHoras(
    @Req() req: RequisicaoMotorista,
    @Query('ano') anoQuery?: string,
    @Query('mes') mesQuery?: string,
  ) {
    const agora = new Date();
    const inicioMesAtual = inicioDoMes(agora);
    const inicioMes = resolverInicioMesSolicitado(agora, anoQuery, mesQuery);
    const ehMesAtual = inicioMes.getTime() === inicioMesAtual.getTime();
    // Mês atual: período vai até agora mesmo (continua contando ao
    // longo do dia). Mês anterior: já está encerrado, vai até o
    // último instante dele.
    const fimPeriodo = ehMesAtual ? agora : fimDoMes(inicioMes);

    const [mes, bancoHorasAtivo] = await Promise.all([
      this.holerite.calcular(
        req.motorista.id,
        inicioMes,
        fimPeriodo,
        { direcaoEspera: true, normalExtra: true, adicionalNoturno: true },
        req.grupoId,
      ),
      this.bancoHoras.estaAtivoParaMotorista(req.motorista.id),
    ]);

    let bancoHoras: {
      ativo: boolean;
      saldoMesMin: number;
      saldoTotalMin: number;
    } | null = null;
    if (bancoHorasAtivo) {
      const [saldoMes, saldoTotal] = await Promise.all([
        this.bancoHoras.calcularSaldo(
          req.motorista.id,
          inicioMes,
          fimPeriodo,
          req.grupoId,
        ),
        this.bancoHoras.calcularSaldo(
          req.motorista.id,
          req.motorista.createdAt,
          agora,
          req.grupoId,
        ),
      ]);
      bancoHoras = {
        ativo: true,
        saldoMesMin: saldoMes.saldoMin,
        saldoTotalMin: saldoTotal.saldoMin,
      };
    }

    return {
      periodoInicio: inicioMes,
      periodoFim: fimPeriodo,
      ehMesAtual,
      horasMes: mes.totais,
      bancoHoras,
    };
  }
}
