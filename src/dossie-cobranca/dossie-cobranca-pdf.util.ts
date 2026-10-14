import { RelatorioPdf } from '../common/pdf/relatorio-pdf';
import { agoraDoCliente, instanteDoEvento } from '../common/fuso/fuso-contexto';
import type { ItemDossieCobranca } from './dossie-cobranca.service';

function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * PDF do Dossiê de Cobrança , um por ocorrência (dia em que o motorista
 * passou do limiar legal de 5h de espera em carga/descarga), agrupado
 * por motorista. Pensado para ser entregue ao setor de faturamento
 * (pra cobrar o excedente do embarcador/contratante) , nunca calcula
 * nem exibe valor em R$ (o mesmo princípio de "só horas" já adotado no
 * holerite/indicadores): o valor do frete/hora acordado é decisão da
 * empresa, fora desta plataforma.
 */
export async function gerarPdfDossieCobranca(
  itens: ItemDossieCobranca[],
  empresaNome: string,
  periodoInicio: Date,
  periodoFim: Date,
): Promise<Buffer> {
  const r = new RelatorioPdf({
    titulo: 'Dossiê de Cobrança - Tempo de Espera em Carga/Descarga',
    rodape: 'Dossiê de cobrança',
  });
  r.cabecalho({
    titulo: 'Dossiê de Cobrança',
    subtitulo: 'Tempo de espera em carga/descarga',
    campos: [
      ['Empresa', empresaNome],
      [
        // Rodada 97 , periodoInicio/periodoFim do filtro (calendário, meia-noite
        // UTC) precisam de timeZone: 'UTC' pra não voltar 1 dia; "Gerado em"
        // vai na hora de quem gerou o documento (fuso do computador).
        'Período',
        `${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
      ],
      ['Gerado em', agoraDoCliente()],
    ],
    aviso:
      'Base legal: Lei 13.103/2015 (Lei do Motorista), art. 235-A, §9º , o tempo de espera para carga/descarga ' +
      'que excede 5 (cinco) horas na mesma jornada pode ser cobrado do embarcador/contratante do frete. Este ' +
      'documento reúne as ocorrências detectadas automaticamente pelo motor de limites legais, com data, horários ' +
      'e duração de cada espera. O valor a cobrar (frete/hora acordado) não é calculado aqui , preencher ' +
      'manualmente na conferência com o setor de faturamento.',
  });
  r.doc.moveDown(0.8);

  r.secao('Ocorrências', `${itens.length} ocorrência(s) no período`);
  if (itens.length === 0) {
    r.vazio('Nenhuma ocorrência de espera acima do limiar legal neste período.');
    return r.finalizar();
  }

  for (const item of itens) {
    r.garantirEspaco(110);
    r.subsecao(
      item.motoristaNome,
      `CPF: ${item.motoristaCpf}   |   Ocorrência detectada em: ${instanteDoEvento(item.criadoEm, item.fusoCriadoEmMin)}`,
    );
    r.camposChaveValor([
      [
        'Janela avaliada',
        `${instanteDoEvento(new Date(item.periodoInicio), item.fusoPeriodoInicioMin)} até ${instanteDoEvento(new Date(item.periodoFim), item.fusoPeriodoFimMin)}`,
      ],
      ['Total de espera', formatarHoras(item.minutosTotais)],
    ]);
    r.tabela(
      [
        { titulo: 'Início', largura: 4 },
        { titulo: 'Fim', largura: 4 },
        { titulo: 'Duração', largura: 2, alinhamento: 'right' },
      ],
      item.intervalos.map((intervalo) => {
        const inicio = new Date(intervalo.inicio);
        const fim = new Date(intervalo.fim);
        const duracaoMin = Math.round(
          (fim.getTime() - inicio.getTime()) / 60000,
        );
        return [
          instanteDoEvento(inicio, intervalo.fusoInicioMin),
          instanteDoEvento(fim, intervalo.fusoFimMin),
          formatarHoras(duracaoMin),
        ];
      }),
    );
    r.doc.moveDown(0.3);
    r.nota(item.observacao, { justificar: false });
    r.doc.moveDown(0.6);
  }

  return r.finalizar();
}
