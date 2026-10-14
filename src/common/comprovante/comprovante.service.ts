import { Injectable } from '@nestjs/common';
import { agoraDoCliente, instanteDoEvento } from '../fuso/fuso-contexto';
import { RelatorioPdf } from '../pdf/relatorio-pdf';
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
    const r = new RelatorioPdf({
      titulo: 'Comprovante de registro de jornada',
      rodape: 'Comprovante de registro de jornada',
    });
    r.cabecalho({
      titulo: 'Comprovante de registro de jornada',
      subtitulo: motorista.nome,
      // Empregador primeiro , é o dado que precisa bater com o contrato de
      // trabalho do motorista quando o grupo tem mais de um CNPJ, mesmo o
      // documento sendo emitido/assinado pela FVF Hórus.
      campos: [
        ['Empregador', empresa.razaoSocial],
        ['CNPJ', empresa.cnpj],
        ['Motorista', motorista.nome],
        ['CPF', motorista.cpf],
        ['CNH', motorista.cnh],
        [
          // Rodada 97 , periodoInicio/periodoFim vêm de <input type="date">
          // (meia-noite UTC do dia escolhido, não um instante real) , ver
          // holerite-pdf.util.ts. timeZone: 'UTC' evita imprimir o dia anterior.
          'Período',
          `${periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`,
        ],
        ['Gerado em', agoraDoCliente()],
        ['Hash gênesis da cadeia', motorista.hashGenesis],
      ],
    });
    r.doc.moveDown(0.8);

    r.secao(
      'Registros do período',
      `Total de registros no período: ${registros.length}`,
    );
    if (registros.length === 0) {
      r.vazio('Nenhum registro no período.');
    } else {
      r.tabela(
        [
          { titulo: '#', largura: 1.2, alinhamento: 'right' },
          { titulo: 'Evento', largura: 3 },
          { titulo: 'Data e hora', largura: 3.4 },
          { titulo: 'Hash', largura: 3.2 },
          { titulo: 'Disp.', largura: 1.6 },
        ],
        registros.map((registro) => [
          String(registro.sequencial),
          registro.tipoEvento + (registro.observacao ? ` (${registro.observacao})` : ''),
          instanteDoEvento(
            new Date(registro.timestampEvento),
            registro.fusoOffsetMin,
          ),
          `${registro.hashAtual.slice(0, 24)}…`,
          `${registro.deviceUuidUsado.slice(0, 8)}…`,
        ]),
        { tamanhoFonte: 7.5 },
      );
    }

    r.doc.moveDown(0.8);
    const ultimoHash = registros.at(-1)?.hashAtual ?? motorista.hashGenesis;
    r.nota(
      `Este comprovante é um extrato do ledger imutável do motorista. O hash do último evento listado ` +
        `(${ultimoHash}) pode ser conferido contra a verificação de integridade da cadeia a qualquer momento , ` +
        `qualquer alteração posterior nos registros originais quebraria esse hash.`,
    );
    return r.finalizar();
  }
}
