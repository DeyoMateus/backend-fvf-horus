import { CategoriaTransporteSindical } from '@prisma/client';
export declare class CreateRegraSindicalDto {
    nome: string;
    categoriaTransporte?: CategoriaTransporteSindical;
    toleranciaMarcacaoMin?: number;
    limiteJornadaNormalMin?: number;
    limiteHoraExtraFaixa1Min?: number;
    percentualHoraExtra1?: number;
    percentualHoraExtra2?: number;
    percentualHoraExtraDomingoFeriado?: number;
    percentualAdicionalNoturno?: number;
    duracaoMinutoNoturnoMin?: number;
    bancoHorasAtivo?: boolean;
    bancoHorasPrazoExpiracaoMeses?: number;
    bancoHorasLimiteAlertaMin?: number;
    primeiroPeriodoDescansoMinimoMin?: number;
    intervaloRefeicaoMinimoMin?: number;
    percentualHoraEspera?: number;
    percentualHoraEsperaRefeicao?: number;
    ativo?: boolean;
}
