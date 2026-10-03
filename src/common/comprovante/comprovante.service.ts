import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Motorista, RegistroJornada } from '@prisma/client';

/**
 * Dados da empresa (CNPJ específico) a que o motorista está vinculado
 * no momento , não o grupo, e sim a Empresa exata escolhida no
 * cadastro dele (ver EmpresasPage.tsx / seletor de empresa na tela de
 * Motoristas). Um grupo pode ter vários CNPJs; o comprovante precisa
 * refletir sempre o CNPJ do vínculo empregatício real do motorista, não
 * um CNPJ qualquer do grupo, mesmo que quem assina digitalmente seja
 * sempre a FVF Hórus (ver CertificateService , o certificado é emitido
 * pela CA interna da FVF Hórus, mas o campo `organizationName` do
 * certificado já embute o CNPJ da empresa correta desde a geração).
 */
export interface EmpresaDoComprovante {
  razaoSocial: string;
  cnpj: string;
}

/**
 * Comprovante em PDF dos pontos batidos num período , pedido pela
 * apresentação comercial ("PDF de comprovante"), tanto pro motorista
 * baixar pelo app quanto pro RH baixar pelo painel.
 *
 * NÃO é um documento assinado digitalmente por si só (a assinatura
 * verdadeira é por registro, na cadeia de hashes , ver
 * `HashChainService`/`SignatureService`). O PDF só materializa o que já
 * está na cadeia, com o hashGenesis e o hashAtual do último evento do
 * período impressos, pra qualquer auditor poder pedir a verificação de
 * integridade completa (`GET /registros-jornada/motorista/:id/verificar-integridade`)
 * e confirmar que o extrato não foi adulterado depois de gerado.
 */
@Injectable()
export class ComprovanteService {
  async gerarPdfRegistros(
    motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh' | 'hashGenesis'>,
    empresa: EmpresaDoComprovante,
    registros: RegistroJornada[],
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
      .text('FVF Hórus , Comprovante de registro de jornada', {
        align: 'center',
      });
    doc.moveDown();

    doc.fontSize(10).fillColor('#374151');
    // Empregador primeiro, em destaque , é o dado que precisa bater com
    // o contrato de trabalho do motorista quando o grupo tem mais de um
    // CNPJ, mesmo o documento sendo emitido/assinado pela FVF Hórus.
    doc.font('Helvetica-Bold').text(`Empregador: ${empresa.razaoSocial}`);
    doc.font('Helvetica').text(`CNPJ: ${empresa.cnpj}`);
    doc.moveDown(0.5);
    doc.text(`Motorista: ${motorista.nome}`);
    doc.text(`CPF: ${motorista.cpf}   CNH: ${motorista.cnh}`);
    doc.text(
      // Rodada 97 , periodoInicio/periodoFim vêm de <input type="date">
      // (meia-noite UTC do dia escolhido, não um instante real) , ver
      // comentário completo em holerite-pdf.util.ts. timeZone: 'UTC'
      // evita o processo imprimir o dia anterior por causa do fuso
      // America/Sao_Paulo (UTC-3).
      `Período: ${periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`,
    );
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    doc.text(`Hash gênesis da cadeia: ${motorista.hashGenesis}`);
    doc.moveDown();

    doc.fontSize(9).fillColor('#111827');
    doc.text(`Total de registros no período: ${registros.length}`, {
      underline: registros.length === 0,
    });
    doc.moveDown(0.5);

    for (const registro of registros) {
      doc
        .fontSize(9)
        .fillColor('#111827')
        .text(
          `#${registro.sequencial}  ${registro.tipoEvento}  ,  ${new Date(registro.timestampEvento).toLocaleString('pt-BR')}` +
            (registro.observacao ? `  (${registro.observacao})` : ''),
        );
      doc
        .fontSize(7)
        .fillColor('#6b7280')
        .text(
          `   hash: ${registro.hashAtual.slice(0, 24)}…  dispositivo: ${registro.deviceUuidUsado.slice(0, 8)}…`,
        );
    }

    doc.moveDown();
    const ultimoHash = registros.at(-1)?.hashAtual ?? motorista.hashGenesis;
    doc
      .fontSize(8)
      .fillColor('#6b7280')
      .text(
        `Este comprovante é um extrato do ledger imutável do motorista. O hash do último evento listado ` +
          `(${ultimoHash}) pode ser conferido contra a verificação de integridade da cadeia a qualquer momento , ` +
          `qualquer alteração posterior nos registros originais quebraria esse hash.`,
        { align: 'justify' },
      );

    doc.end();
    return finalizado;
  }
}
