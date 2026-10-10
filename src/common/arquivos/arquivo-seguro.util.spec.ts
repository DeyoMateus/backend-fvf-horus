import {
  contentDispositionAnexo,
  nomeArquivoSeguro,
  detectarTipoImagem,
  nomeComExtensaoDoTipo,
} from './arquivo-seguro.util';

describe('arquivo-seguro.util', () => {
  it('remove caminho, aspas e caracteres de controle', () => {
    expect(nomeArquivoSeguro('../../etc/pa"sswd.png')).toBe('passwd.png');
    expect(nomeArquivoSeguro('a\r\nb.pdf')).toBe('ab.pdf');
    expect(nomeArquivoSeguro('')).toBe('arquivo');
    expect(nomeArquivoSeguro('...')).toBe('arquivo');
  });

  it('limita o tamanho preservando a extensão', () => {
    const n = nomeArquivoSeguro('x'.repeat(300) + '.pdf');
    expect(n.length).toBeLessThanOrEqual(120);
    expect(n.endsWith('.pdf')).toBe(true);
  });

  it('gera Content-Disposition válido com acentos', () => {
    const h = contentDispositionAnexo('Relatório ação ń.pdf');
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7e]+$/.test(h)).toBe(true);
    expect(h).toContain("filename*=UTF-8''");
  });

  const completo = (cabeca: number[]) =>
    Buffer.concat([Buffer.from(cabeca), Buffer.alloc(32)]);

  it('detecta imagens pelo conteúdo, inclusive HEIC do iPhone', () => {
    expect(detectarTipoImagem(completo([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe(
      'image/jpeg',
    );
    expect(
      detectarTipoImagem(
        completo([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )?.mime,
    ).toBe('image/png');
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.alloc(8),
    ]);
    expect(detectarTipoImagem(webp)?.mime).toBe('image/webp');
    const heic = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypheic'),
      Buffer.alloc(16),
    ]);
    expect(detectarTipoImagem(heic)?.mime).toBe('image/heic');
  });

  it('recusa PDF, SVG, HTML e arquivo renomeado', () => {
    expect(detectarTipoImagem(Buffer.from('%PDF-1.7\n' + 'x'.repeat(40)))).toBeNull();
    expect(detectarTipoImagem(Buffer.from('<svg xmlns="x"></svg>'))).toBeNull();
    expect(detectarTipoImagem(Buffer.from('<html><script>1</script></html>'))).toBeNull();
    expect(detectarTipoImagem(Buffer.from('MZ' + 'x'.repeat(40)))).toBeNull();
    expect(detectarTipoImagem(undefined)).toBeNull();
    const avif = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from('ftypavif'),
      Buffer.alloc(16),
    ]);
    expect(detectarTipoImagem(avif)).toBeNull();
  });

  it('corrige a extensão do nome para a do tipo real', () => {
    const jpg = { mime: 'image/jpeg', extensao: '.jpg' };
    expect(nomeComExtensaoDoTipo('foto.jpeg', jpg)).toBe('foto.jpeg');
    expect(nomeComExtensaoDoTipo('relatorio.pdf', jpg)).toBe('relatorio.jpg');
    expect(nomeComExtensaoDoTipo('IMG_1.HEIC', { mime: 'image/heic', extensao: '.heic' })).toBe('IMG_1.HEIC');
  });
});
