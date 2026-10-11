"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENSAGEM_SO_IMAGEM = void 0;
exports.nomeArquivoSeguro = nomeArquivoSeguro;
exports.contentDispositionAnexo = contentDispositionAnexo;
exports.detectarTipoImagem = detectarTipoImagem;
exports.nomeComExtensaoDoTipo = nomeComExtensaoDoTipo;
function nomeArquivoSeguro(nome) {
    const base = (nome ?? '').split(/[\\/]/).pop() ?? '';
    const limpo = base
        .replace(/[\u0000-\u001f\u007f"<>:*?|;]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+/, '');
    if (!limpo)
        return 'arquivo';
    if (limpo.length <= 120)
        return limpo;
    const ponto = limpo.lastIndexOf('.');
    const ext = ponto > 0 && limpo.length - ponto <= 10 ? limpo.slice(ponto) : '';
    return limpo.slice(0, 120 - ext.length) + ext;
}
function contentDispositionAnexo(nome) {
    const seguro = nomeArquivoSeguro(nome);
    const ascii = seguro
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\x20-\x7e]/g, '_')
        .replace(/%/g, '_');
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(seguro)}`;
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
function detectarTipoImagem(buffer) {
    if (!buffer || buffer.length < 12)
        return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mime: 'image/jpeg', extensao: '.jpg' };
    }
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mime: 'image/png', extensao: '.png' };
    }
    if (buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP') {
        return { mime: 'image/webp', extensao: '.webp' };
    }
    if (buffer.toString('ascii', 4, 8) === 'ftyp' &&
        MARCAS_HEIF.has(buffer.toString('ascii', 8, 12).toLowerCase())) {
        return { mime: 'image/heic', extensao: '.heic' };
    }
    return null;
}
function nomeComExtensaoDoTipo(nome, tipo) {
    const seguro = nomeArquivoSeguro(nome);
    const equivalentes = {
        '.jpg': ['.jpg', '.jpeg'],
        '.png': ['.png'],
        '.webp': ['.webp'],
        '.heic': ['.heic', '.heif'],
    };
    const minusculo = seguro.toLowerCase();
    const ok = (equivalentes[tipo.extensao] ?? []).some((e) => minusculo.endsWith(e));
    if (ok)
        return seguro;
    const ponto = seguro.lastIndexOf('.');
    const base = ponto > 0 ? seguro.slice(0, ponto) : seguro;
    return base + tipo.extensao;
}
exports.MENSAGEM_SO_IMAGEM = 'Só é possível anexar IMAGENS (JPG, PNG, WEBP ou HEIC/HEIF, o formato das fotos do iPhone). PDF e outros arquivos não são aceitos: tire um print ou uma foto do documento e anexe a imagem.';
//# sourceMappingURL=arquivo-seguro.util.js.map