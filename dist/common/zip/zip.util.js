"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarZip = criarZip;
const zlib_1 = require("zlib");
function dosDataHoraAgora() {
    const agora = new Date();
    const data = (((agora.getFullYear() - 1980) & 0x7f) << 9) |
        ((agora.getMonth() + 1) << 5) |
        agora.getDate();
    const hora = (agora.getHours() << 11) |
        (agora.getMinutes() << 5) |
        Math.floor(agora.getSeconds() / 2);
    return { data, hora };
}
function criarZip(arquivos) {
    const { data: dosData, hora: dosHora } = dosDataHoraAgora();
    const partesLocais = [];
    const partesCentrais = [];
    let offset = 0;
    for (const arquivo of arquivos) {
        const nomeBuf = Buffer.from(arquivo.nome, 'utf8');
        const crc = (0, zlib_1.crc32)(arquivo.conteudo) >>> 0;
        const tamanho = arquivo.conteudo.length;
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosHora, 10);
        localHeader.writeUInt16LE(dosData, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(tamanho, 18);
        localHeader.writeUInt32LE(tamanho, 22);
        localHeader.writeUInt16LE(nomeBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);
        partesLocais.push(localHeader, nomeBuf, arquivo.conteudo);
        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosHora, 12);
        centralHeader.writeUInt16LE(dosData, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(tamanho, 20);
        centralHeader.writeUInt32LE(tamanho, 24);
        centralHeader.writeUInt16LE(nomeBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        partesCentrais.push(centralHeader, nomeBuf);
        offset += localHeader.length + nomeBuf.length + tamanho;
    }
    const inicioDiretorioCentral = offset;
    const tamanhoDiretorioCentral = partesCentrais.reduce((soma, buf) => soma + buf.length, 0);
    const fimDiretorioCentral = Buffer.alloc(22);
    fimDiretorioCentral.writeUInt32LE(0x06054b50, 0);
    fimDiretorioCentral.writeUInt16LE(0, 4);
    fimDiretorioCentral.writeUInt16LE(0, 6);
    fimDiretorioCentral.writeUInt16LE(arquivos.length, 8);
    fimDiretorioCentral.writeUInt16LE(arquivos.length, 10);
    fimDiretorioCentral.writeUInt32LE(tamanhoDiretorioCentral, 12);
    fimDiretorioCentral.writeUInt32LE(inicioDiretorioCentral, 16);
    fimDiretorioCentral.writeUInt16LE(0, 20);
    return Buffer.concat([
        ...partesLocais,
        ...partesCentrais,
        fimDiretorioCentral,
    ]);
}
//# sourceMappingURL=zip.util.js.map