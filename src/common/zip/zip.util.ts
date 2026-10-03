import { crc32 } from 'zlib';

/**
 * Empacotador ZIP mínimo (Rodada 82, pedido do usuário: "caso o gestor
 * selecione mais de um motorista os arquivos devem ser separados cada
 * motorista com seu relatorio") , usado só pra entregar N PDFs
 * separados (um por motorista) como um único download no navegador,
 * sem precisar de N requisições HTTP.
 *
 * Deliberadamente sem dependência nova (mesma decisão documentada em
 * `MonitoramentoJornadaAbertaService` sobre `@nestjs/schedule` , este
 * ambiente já teve `npm install` travado por OneDrive/antivírus
 * seguras vezes, Rodada 4/6): implementa só o subconjunto do formato
 * ZIP necessário aqui, método STORED (sem recompressão , cada PDF já
 * é internamente comprimido pelo pdfkit, recomprimir não economizaria
 * espaço) usando `zlib.crc32`, nativo do Node desde a v21. Não
 * suporta Zip64, nomes de arquivo não-ASCII avançados nem
 * compressão , não precisa, são sempre poucos PDFs de motorista por
 * fechamento.
 */
export interface ArquivoParaZip {
  nome: string;
  conteudo: Buffer;
}

function dosDataHoraAgora(): { data: number; hora: number } {
  const agora = new Date();
  const data =
    (((agora.getFullYear() - 1980) & 0x7f) << 9) |
    ((agora.getMonth() + 1) << 5) |
    agora.getDate();
  const hora =
    (agora.getHours() << 11) |
    (agora.getMinutes() << 5) |
    Math.floor(agora.getSeconds() / 2);
  return { data, hora };
}

export function criarZip(arquivos: ArquivoParaZip[]): Buffer {
  const { data: dosData, hora: dosHora } = dosDataHoraAgora();
  const partesLocais: Buffer[] = [];
  const partesCentrais: Buffer[] = [];
  let offset = 0;

  for (const arquivo of arquivos) {
    const nomeBuf = Buffer.from(arquivo.nome, 'utf8');
    const crc = crc32(arquivo.conteudo) >>> 0;
    const tamanho = arquivo.conteudo.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // assinatura local file header
    localHeader.writeUInt16LE(20, 4); // versão mínima (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // flag bit 11: nome de arquivo em UTF-8
    localHeader.writeUInt16LE(0, 8); // método de compressão: 0 = stored (sem compressão)
    localHeader.writeUInt16LE(dosHora, 10);
    localHeader.writeUInt16LE(dosData, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(tamanho, 18); // tamanho comprimido = tamanho real (stored)
    localHeader.writeUInt32LE(tamanho, 22); // tamanho descomprimido
    localHeader.writeUInt16LE(nomeBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    partesLocais.push(localHeader, nomeBuf, arquivo.conteudo);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // assinatura central directory header
    centralHeader.writeUInt16LE(20, 4); // versão que criou
    centralHeader.writeUInt16LE(20, 6); // versão mínima
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosHora, 12);
    centralHeader.writeUInt16LE(dosData, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(tamanho, 20);
    centralHeader.writeUInt32LE(tamanho, 24);
    centralHeader.writeUInt16LE(nomeBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // offset do local file header

    partesCentrais.push(centralHeader, nomeBuf);

    offset += localHeader.length + nomeBuf.length + tamanho;
  }

  const inicioDiretorioCentral = offset;
  const tamanhoDiretorioCentral = partesCentrais.reduce(
    (soma, buf) => soma + buf.length,
    0,
  );

  const fimDiretorioCentral = Buffer.alloc(22);
  fimDiretorioCentral.writeUInt32LE(0x06054b50, 0); // assinatura end of central directory
  fimDiretorioCentral.writeUInt16LE(0, 4); // número deste disco
  fimDiretorioCentral.writeUInt16LE(0, 6); // disco onde começa o diretório central
  fimDiretorioCentral.writeUInt16LE(arquivos.length, 8); // entradas neste disco
  fimDiretorioCentral.writeUInt16LE(arquivos.length, 10); // total de entradas
  fimDiretorioCentral.writeUInt32LE(tamanhoDiretorioCentral, 12);
  fimDiretorioCentral.writeUInt32LE(inicioDiretorioCentral, 16);
  fimDiretorioCentral.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([
    ...partesLocais,
    ...partesCentrais,
    fimDiretorioCentral,
  ]);
}
