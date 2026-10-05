import PDFDocument from 'pdfkit';
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
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finalizado = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc
    .fontSize(16)
    .text('Dossiê de Cobrança , Tempo de Espera em Carga/Descarga', {
      align: 'center',
    });
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor('#374151')
    .text(
      // Rodada 97 , periodoInicio/periodoFim do filtro (calendário, meia-noite
      // UTC) precisam de timeZone: 'UTC' pra não voltar 1 dia; "Gerado em"
      // vai na hora de quem gerou o documento (fuso do computador).
      `${empresaNome}   |   Período: ${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}   |   Gerado em: ${agoraDoCliente()}`,
      { align: 'center' },
    );
  doc.moveDown();
  doc
    .fontSize(8)
    .fillColor('#6b7280')
    .text(
      'Base legal: Lei 13.103/2015 (Lei do Motorista), art. 235-A, §9º , o tempo de espera para carga/descarga ' +
        'que excede 5 (cinco) horas na mesma jornada pode ser cobrado do embarcador/contratante do frete. Este ' +
        'documento reúne as ocorrências detectadas automaticamente pelo motor de limites legais, com data, horários ' +
        'e duração de cada espera. O valor a cobrar (frete/hora acordado) não é calculado aqui , preencher ' +
        'manualmente na conferência com o setor de faturamento.',
      { align: 'left' },
    );
  doc.moveDown();

  if (itens.length === 0) {
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(
        'Nenhuma ocorrência de espera acima do limiar legal neste período.',
      );
    doc.end();
    return finalizado;
  }

  for (const item of itens) {
    doc
      .fontSize(11)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(item.motoristaNome);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#374151')
      .text(
        `CPF: ${item.motoristaCpf}   |   Ocorrência detectada em: ${instanteDoEvento(item.criadoEm, item.fusoCriadoEmMin)}`,
      );
    doc.text(
      `Janela avaliada: ${instanteDoEvento(new Date(item.periodoInicio), item.fusoPeriodoInicioMin)} até ${instanteDoEvento(new Date(item.periodoFim), item.fusoPeriodoFimMin)}`,
    );
    doc
      .font('Helvetica-Bold')
      .text(`Total de espera: ${formatarHoras(item.minutosTotais)}`);
    doc.font('Helvetica').moveDown(0.2);

    doc.fontSize(9).text('Intervalos de espera:');
    for (const intervalo of item.intervalos) {
      const inicio = new Date(intervalo.inicio);
      const fim = new Date(intervalo.fim);
      const duracaoMin = Math.round((fim.getTime() - inicio.getTime()) / 60000);
      doc.text(
        `  • ${instanteDoEvento(inicio, intervalo.fusoInicioMin)} → ${instanteDoEvento(fim, intervalo.fusoFimMin)} (${formatarHoras(duracaoMin)})`,
      );
    }
    doc.fontSize(8).fillColor('#6b7280').text(item.observacao);
    doc.fillColor('#111827');
    doc.moveDown(0.6);
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.x + 515, doc.y)
      .strokeColor('#e5e7eb')
      .stroke();
    doc.moveDown(0.6);
  }

  doc.end();
  return finalizado;
}
