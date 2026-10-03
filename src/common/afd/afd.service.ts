import { BadRequestException, Injectable } from '@nestjs/common';
import type { Motorista, RegistroJornada } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NsrService } from '../nsr/nsr.service';

/**
 * AFD , Arquivo Fonte de Dados, Portaria MTP 671/2021 (MTE), leiaute
 * versão 004, perfil REP-P (registrador ponto eletrônico baseado em
 * software, sem hardware certificado , é o nosso caso).
 *
 * Especificação usada (texto ASCII de largura fixa, CR+LF, CRC-16
 * Kermit por registro 1/5/7, SHA-256 no registro 7): leiaute oficial
 * publicado pelo MTE ,
 * https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf
 * Análise de viabilidade completa em claude/viabilidade-afd-671.md (doc
 * do projeto). Ao contrário do que um comentário antigo neste código
 * dizia, o AFD NÃO é um formato binário proprietário , é texto com
 * campos de posição fixa, especificação pública.
 *
 * Os dois pontos que antes exigiam confirmação contra o PDF oficial
 * (marcados no código como TODO-VALIDAR) foram validados na Rodada 34
 * direto contra o próprio PDF do MTE e o FAQ oficial da Portaria
 * 671/2021 (ver claude/viabilidade-afd-671.md):
 *   1. Representação do CRC-16: confirmado , hex direto do valor
 *      calculado, sem troca de bytes. O próprio FAQ oficial usa
 *      "123456789" → 0x2189 → grava "2189" como exemplo; nosso
 *      `crc16Hex('123456789')` produz exatamente "2189".
 *   2. Campo de assinatura digital do registro tipo 9: confirmado ,
 *      bloco de 100 caracteres alfanuméricos ANEXADO após os 64
 *      caracteres numéricos do trailer, nunca sobreposto a eles.
 *
 * O que este serviço NÃO resolve (são bloqueios de negócio, não de
 * código , ver claude/bloqueios-dependentes-do-usuario.md):
 *   - Assinatura digital ICP-Brasil do empregador no registro tipo 9
 *     (campo fica em branco até a empresa ter um certificado e-CNPJ).
 *   - Número de registro do software no INPI (Empresa.registroInpiAfd) ,
 *     sem ele, a exportação é bloqueada com erro claro em vez de usar
 *     um número fictício.
 */
@Injectable()
export class AfdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nsr: NsrService,
  ) {}

  async gerarArquivo(
    empresaId: string,
    inicio: Date,
    fim: Date,
  ): Promise<{ nomeArquivo: string; conteudo: string }> {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: empresaId },
    });

    if (!empresa.registroInpiAfd) {
      throw new BadRequestException(
        'Esta empresa ainda não tem o número de registro do software no INPI cadastrado ' +
          '(Empresa.registroInpiAfd). Isso é exigido pela Portaria 671/2021 pra compor o nome ' +
          'do arquivo AFD do REP-P. Cadastre o número antes de exportar.',
      );
    }

    const motoristas = await this.prisma.motorista.findMany({
      where: { empresaId },
    });
    const registros = await this.prisma.registroJornada.findMany({
      where: {
        motorista: { empresaId },
        timestampEvento: { gte: inicio, lte: fim },
      },
      orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
    });

    const linhasTipo5: string[] = [];
    for (const motorista of motoristas) {
      linhasTipo5.push(await this.linhaTipo5Inclusao(motorista));
    }

    const linhasTipo7: string[] = [];
    const motoristaPorId = new Map(motoristas.map((m) => [m.id, m]));
    for (const registro of registros) {
      const motorista = motoristaPorId.get(registro.motoristaId);
      if (!motorista) continue;
      linhasTipo7.push(await this.linhaTipo7Marcacao(motorista, registro));
    }

    const linhaCabecalho = this.linhaTipo1(empresa, inicio, fim, registros);
    const linhaTrailer = this.linhaTipo9({
      qtdTipo2: 0,
      qtdTipo3: 0,
      qtdTipo4: 0,
      qtdTipo5: linhasTipo5.length,
      qtdTipo6: 0,
      qtdTipo7: linhasTipo7.length,
    });

    const linhas = [
      linhaCabecalho,
      ...linhasTipo5,
      ...linhasTipo7,
      linhaTrailer,
    ];
    const conteudo = linhas.join('\r\n') + '\r\n';

    const cnpjDigitos = empresa.cnpj.replace(/\D/g, '');
    const nomeArquivo = `AFD${empresa.registroInpiAfd}${cnpjDigitos}REP_P.txt`;

    return { nomeArquivo, conteudo };
  }

  // --- Registro tipo 1 (cabeçalho) ------------------------------------

  private linhaTipo1(
    empresa: {
      cnpj: string;
      razaoSocial: string;
      registroInpiAfd: string | null;
    },
    inicio: Date,
    fim: Date,
    registros: RegistroJornada[],
  ): string {
    const cnpjDigitos = empresa.cnpj.replace(/\D/g, '');
    const dataInicial = registros[0]?.timestampEvento ?? inicio;
    const dataFinal = registros[registros.length - 1]?.timestampEvento ?? fim;

    const semCrc =
      this.padN('0', 9) + // 001-009 "000000000"
      this.padN('1', 1) + // 010 tipo do registro
      this.padN('1', 1) + // 011 tipo de identificador (1=CNPJ)
      this.padA(cnpjDigitos, 14) + // 012-025 CNPJ do empregador
      this.padN('', 14) + // 026-039 CNO/CAEPF , zero-fill = campo não aplicável (convenção comum nesses leiautes do governo pra empresas sem CNO/CAEPF, ex.: transportadora sem obra/atividade rural cadastrada)
      this.padA(empresa.razaoSocial, 150) + // 040-189 razão social
      this.padN(empresa.registroInpiAfd ?? '', 17) + // 190-206 nº INPI
      this.fmtData(dataInicial) + // 207-216
      this.fmtData(dataFinal) + // 217-226
      this.fmtDataHora(new Date()) + // 227-250 geração
      this.padN('4', 3) + // 251-253 versão do leiaute "004"
      this.padN('2', 1) + // 254 tipo identificador fabricante (2=CPF , a FVF Hórus como fabricante do software)
      this.padA(cnpjDigitos, 14) + // 255-268 CNPJ/CPF do fabricante (mesma empresa, enquanto não houver fabricante terceiro)
      this.padA('FVF HORUS', 30); // 269-298 modelo/software

    return semCrc + this.crc16Hex(semCrc);
  }

  // --- Registro tipo 5 (gestão de motoristas) -------------------------

  private async linhaTipo5Inclusao(motorista: Motorista): Promise<string> {
    const nsr = await this.nsr.obterOuCriar(
      `motorista-inclusao:${motorista.id}`,
      5,
    );
    const cpfDigitos = motorista.cpf.replace(/\D/g, '');

    const semCrc =
      this.padN(String(nsr), 9) +
      this.padN('5', 1) +
      this.fmtDataHora(motorista.createdAt) +
      this.padA('I', 1) + // I = inclusão. Alteração/exclusão de motorista ainda não geram evento tipo 5 , ver comentário abaixo.
      this.padN(cpfDigitos, 12) +
      this.padA(motorista.nome, 52) +
      this.padA('', 4) +
      this.padN(cpfDigitos, 11); // responsável pela alteração , usamos o próprio CPF do motorista na inclusão inicial, na falta de um registro de "quem cadastrou"

    return semCrc + this.crc16Hex(semCrc);
  }

  // --- Registro tipo 7 (marcação REP-P) -------------------------------

  private async linhaTipo7Marcacao(
    motorista: Motorista,
    registro: RegistroJornada,
  ): Promise<string> {
    const nsr = await this.nsr.obterOuCriar(`registro:${registro.id}`, 7);
    const cpfDigitos = motorista.cpf.replace(/\D/g, '');
    const hashSha256 = createHash('sha256')
      .update(registro.hashAtual)
      .digest('hex');

    const semCrc =
      this.padN(String(nsr), 9) +
      this.padN('7', 1) +
      this.fmtDataHora(registro.timestampEvento) +
      this.padN(cpfDigitos, 12) +
      this.fmtDataHora(registro.createdAt) +
      this.padN('1', 2) + // identificador do coletor (01-05) , app único até termos múltiplos coletores por motorista
      this.padN('0', 1) + // 0 = on-line. O app funciona offline, mas todo registro exportado aqui já foi sincronizado (é isso que "gravação" no campo anterior representa).
      this.padA(hashSha256, 64);

    return semCrc + this.crc16Hex(semCrc);
  }

  // --- Registro tipo 9 (trailer) --------------------------------------

  private linhaTipo9(contadores: {
    qtdTipo2: number;
    qtdTipo3: number;
    qtdTipo4: number;
    qtdTipo5: number;
    qtdTipo6: number;
    qtdTipo7: number;
  }): string {
    const corpo =
      this.padN('9', 9) + // "999999999"
      this.padN(String(contadores.qtdTipo2), 9) +
      this.padN(String(contadores.qtdTipo3), 9) +
      this.padN(String(contadores.qtdTipo4), 9) +
      this.padN(String(contadores.qtdTipo5), 9) +
      this.padN(String(contadores.qtdTipo6), 9) +
      this.padN(String(contadores.qtdTipo7), 9) +
      this.padN('9', 1); // tipo do registro

    // Posicionamento deste campo (bloco de 100 caracteres alfanuméricos
    // ANEXADO após os 64 caracteres numéricos do trailer) CONFIRMADO
    // contra o PDF oficial na Rodada 34. O que falta é só o conteúdo:
    // assinatura digital ICP-Brasil do empregador. Fica em branco (100
    // espaços) até a empresa ter um certificado e-CNPJ , ver
    // claude/bloqueios-dependentes-do-usuario.md. Um trailer com esse
    // campo vazio não deve ser tratado como "assinado" em nenhuma
    // camada acima desta.
    const assinatura = this.padA('', 100);

    return corpo + assinatura;
  }

  // --- NSR global e idempotente ---------------------------------------

  // --- Formatação de campos --------------------------------------------

  /** Campo numérico (N): dígitos apenas, alinhado à direita, zero-padded à esquerda. */
  private padN(valor: string, tamanho: number): string {
    const digitos = valor.replace(/\D/g, '');
    return digitos.slice(-tamanho).padStart(tamanho, '0');
  }

  /** Campo alfanumérico (A): alinhado à esquerda, espaço-padded à direita, truncado se maior. */
  private padA(valor: string, tamanho: number): string {
    return valor.slice(0, tamanho).padEnd(tamanho, ' ');
  }

  /** Campo D: AAAA-MM-dd (10 caracteres). */
  private fmtData(data: Date): string {
    return data.toISOString().slice(0, 10);
  }

  /**
   * Campo DH: AAAA-MM-ddThh:mm:00ZZZZZ (24 caracteres) , ZZZZZ é o
   * offset de fuso em 5 caracteres (ex.: "-0300", sem separador ":").
   * Fixo em -0300 (horário de Brasília, sem horário de verão desde
   * 2019) , se a operação um dia atender motoristas em outro fuso,
   * isto precisa vir do cadastro da empresa/motorista, não fixo aqui.
   */
  private fmtDataHora(data: Date): string {
    const iso = data.toISOString(); // AAAA-MM-ddTHH:mm:ss.sssZ (UTC)
    const dataHoraUtc = new Date(iso);
    const offsetMs = -3 * 60 * 60 * 1000;
    const local = new Date(dataHoraUtc.getTime() + offsetMs);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dataParte = `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
    const horaParte = `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}:00`;
    return `${dataParte}T${horaParte}-0300`;
  }

  /**
   * CRC-16/KERMIT (= CRC-16/CCITT-TRUE), reflected, poly 0x8408, init
   * 0x0000 , calculado sobre todo o conteúdo do registro que precede
   * este campo. Retorna 4 caracteres hex maiúsculos.
   *
   * Ordem de bytes na representação hex CONFIRMADA (Rodada 34) contra
   * o FAQ oficial da Portaria 671/2021: hex direto do valor de 16
   * bits, sem troca de bytes , o próprio exemplo oficial ("123456789"
   * → "2189") bate byte a byte com o retorno desta função.
   */
  private crc16Hex(texto: string): string {
    let crc = 0x0000;
    const buf = Buffer.from(texto, 'latin1');
    for (const byte of buf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = crc & 1 ? (crc >> 1) ^ 0x8408 : crc >>> 1;
      }
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  }
}
