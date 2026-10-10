/**
 * Rodada 191: nome de arquivo vindo do cliente (upload) é dado não
 * confiável. Antes ia cru para a chave do R2 e para o cabeçalho
 * Content-Disposition (aspas quebravam o cabeçalho; caracteres fora do
 * Latin-1 derrubavam o download com 500).
 */

/** Tira caminho, aspas, barras e caracteres de controle; limita o tamanho. */
export function nomeArquivoSeguro(nome: string | undefined | null): string {
  const base = (nome ?? '').split(/[\\/]/).pop() ?? '';
  const limpo = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>:*?|;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  if (!limpo) return 'arquivo';
  if (limpo.length <= 120) return limpo;
  const ponto = limpo.lastIndexOf('.');
  const ext = ponto > 0 && limpo.length - ponto <= 10 ? limpo.slice(ponto) : '';
  return limpo.slice(0, 120 - ext.length) + ext;
}

/** Content-Disposition de download seguro (RFC 6266/5987, aceita acentos). */
export function contentDispositionAnexo(nome: string): string {
  const seguro = nomeArquivoSeguro(nome);
  const ascii = seguro
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/%/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(seguro)}`;
}

export interface TipoImagemDetectado {
  mime: string;
  extensao: string;
}

const MARCAS_HEIF = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
  'heif',
]);

/**
 * Rodada 192: evidência só pode ser IMAGEM, e o tipo vem do CONTEÚDO
 * (assinatura dos primeiros bytes), nunca do mimetype/extensão que o
 * cliente informa. Aceita JPEG, PNG, WEBP e HEIC/HEIF (formato padrão
 * das fotos do iPhone). Devolve null para qualquer outra coisa (PDF,
 * SVG, GIF, HTML, executável, arquivo renomeado etc.).
 */
export function detectarTipoImagem(
  buffer: Buffer | undefined | null,
): TipoImagemDetectado | null {
  if (!buffer || buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extensao: '.jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return { mime: 'image/png', extensao: '.png' };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', extensao: '.webp' };
  }
  // HEIC/HEIF (ISO-BMFF): "ftyp" na posição 4 e marca HEIF na posição 8
  if (
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    MARCAS_HEIF.has(buffer.toString('ascii', 8, 12).toLowerCase())
  ) {
    return { mime: 'image/heic', extensao: '.heic' };
  }
  return null;
}

/** Garante que a extensão do nome bate com o tipo real detectado. */
export function nomeComExtensaoDoTipo(
  nome: string | undefined | null,
  tipo: TipoImagemDetectado,
): string {
  const seguro = nomeArquivoSeguro(nome);
  const equivalentes: Record<string, string[]> = {
    '.jpg': ['.jpg', '.jpeg'],
    '.png': ['.png'],
    '.webp': ['.webp'],
    '.heic': ['.heic', '.heif'],
  };
  const minusculo = seguro.toLowerCase();
  const ok = (equivalentes[tipo.extensao] ?? []).some((e) =>
    minusculo.endsWith(e),
  );
  if (ok) return seguro;
  const ponto = seguro.lastIndexOf('.');
  const base = ponto > 0 ? seguro.slice(0, ponto) : seguro;
  return base + tipo.extensao;
}

export const MENSAGEM_SO_IMAGEM =
  'Só é possível anexar IMAGENS (JPG, PNG, WEBP ou HEIC/HEIF, o formato das fotos do iPhone). PDF e outros arquivos não são aceitos: tire um print ou uma foto do documento e anexe a imagem.';
