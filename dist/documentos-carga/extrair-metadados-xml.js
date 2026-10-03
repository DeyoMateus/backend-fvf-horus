"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extrairMetadadosXml = extrairMetadadosXml;
function extrairMetadadosXml(xmlTexto) {
    const resultado = {};
    const chaveMatch = xmlTexto.match(/Id="(?:CTe|MDFe)(\d{44})"/) ??
        xmlTexto.match(/<ch(?:CTe|MDFe)>(\d{44})<\/ch(?:CTe|MDFe)>/);
    if (chaveMatch)
        resultado.chaveAcesso = chaveMatch[1];
    const numeroMatch = xmlTexto.match(/<nCT>(\d+)<\/nCT>/) ??
        xmlTexto.match(/<nMDF>(\d+)<\/nMDF>/);
    if (numeroMatch)
        resultado.numero = numeroMatch[1];
    const enderecoDestinatario = extrairEnderecoDestinatario(xmlTexto);
    if (enderecoDestinatario)
        resultado.enderecoDestinatario = enderecoDestinatario;
    return resultado;
}
function extrairEnderecoDestinatario(xmlTexto) {
    const blocoMatch = xmlTexto.match(/<enderDest>([\s\S]*?)<\/enderDest>/);
    if (!blocoMatch)
        return undefined;
    const bloco = blocoMatch[1];
    const campo = (tag) => bloco.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim();
    const partes = [
        campo('xLgr'),
        campo('nro'),
        campo('xBairro'),
        campo('xMun'),
        campo('UF'),
        campo('CEP'),
    ].filter((parte) => !!parte);
    if (!partes.length)
        return undefined;
    return `${partes.join(', ')}, Brasil`;
}
//# sourceMappingURL=extrair-metadados-xml.js.map