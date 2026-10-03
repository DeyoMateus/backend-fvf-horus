/**
 * Extração BEST-EFFORT de metadados do XML de CT-e/MDF-e , regex nos
 * padrões mais comuns do layout (atributo `Id="CTe..."`/`Id="MDFe..."`
 * com os 44 dígitos da chave de acesso, a tag `<nCT>`/`<nMDF>` do
 * número do documento, e o bloco `<enderDest>` com o endereço do
 * destinatário, usado pra geocodificar a cerca virtual da entrega).
 * NÃO é um parser/validador de schema oficial: se o layout do XML
 * variar (versão diferente, XML malformado, um emissor que foge do
 * padrão), simplesmente não extrai nada , e isso é esperado, nunca
 * bloqueia o upload. O gestor sempre pode preencher numero/chaveAcesso
 * manualmente no formulário; o endereço do destinatário, se não
 * extraído, só significa que a cerca virtual não é avaliada pra este
 * documento (fail-open).
 */
export interface MetadadosExtraidosXml {
  numero?: string;
  chaveAcesso?: string;
  enderecoDestinatario?: string;
}

export function extrairMetadadosXml(xmlTexto: string): MetadadosExtraidosXml {
  const resultado: MetadadosExtraidosXml = {};

  const chaveMatch =
    xmlTexto.match(/Id="(?:CTe|MDFe)(\d{44})"/) ??
    xmlTexto.match(/<ch(?:CTe|MDFe)>(\d{44})<\/ch(?:CTe|MDFe)>/);
  if (chaveMatch) resultado.chaveAcesso = chaveMatch[1];

  const numeroMatch =
    xmlTexto.match(/<nCT>(\d+)<\/nCT>/) ??
    xmlTexto.match(/<nMDF>(\d+)<\/nMDF>/);
  if (numeroMatch) resultado.numero = numeroMatch[1];

  const enderecoDestinatario = extrairEnderecoDestinatario(xmlTexto);
  if (enderecoDestinatario)
    resultado.enderecoDestinatario = enderecoDestinatario;

  return resultado;
}

/**
 * Concatena os campos do bloco `<enderDest>` (padrão CT-e) numa string
 * de endereço legível o bastante pra um serviço de geocodificação
 * público resolver (ex.: "Rua Exemplo, 123, Centro, São Paulo, SP,
 * 01000000, Brasil"). Só monta a string se achou pelo menos um campo ,
 * mesmo assim, quanto menos campos, pior a chance de geocodificar
 * certo (e o GeocodingService já lida com "não achou nada").
 */
function extrairEnderecoDestinatario(xmlTexto: string): string | undefined {
  const blocoMatch = xmlTexto.match(/<enderDest>([\s\S]*?)<\/enderDest>/);
  if (!blocoMatch) return undefined;
  const bloco = blocoMatch[1];

  const campo = (tag: string): string | undefined =>
    bloco.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim();

  const partes = [
    campo('xLgr'),
    campo('nro'),
    campo('xBairro'),
    campo('xMun'),
    campo('UF'),
    campo('CEP'),
  ].filter((parte): parte is string => !!parte);
  if (!partes.length) return undefined;

  return `${partes.join(', ')}, Brasil`;
}
