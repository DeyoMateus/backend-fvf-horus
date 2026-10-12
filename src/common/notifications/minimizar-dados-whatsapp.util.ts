/**
 * Rodada 213 (LGPD, minimização): o WhatsApp é um canal fora do nosso
 * controle (instância não oficial, mensagens ficam no aparelho de quem
 * recebe). Por isso a mensagem leva só o necessário para o gestor agir.
 */

/** "João da Silva Souza" -> "João S." (primeiro nome + inicial do último sobrenome). */
export function nomeAbreviado(nomeCompleto: string | null | undefined): string {
  const partes = (nomeCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Motorista';
  if (partes.length === 1) return partes[0];
  const ultimo = partes[partes.length - 1];
  return `${partes[0]} ${ultimo.charAt(0).toUpperCase()}.`;
}

/**
 * Última barreira: se algum texto com dado pessoal escapar para uma
 * mensagem, mascara CPF, e-mail, telefone e coordenadas decimais.
 */
export function mascararDadosPessoais(texto: string): string {
  return (
    texto
      // CPF com ou sem pontuação (11 dígitos)
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF omitido]')
      // e-mail
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail omitido]')
      // coordenadas decimais "-23.550520, -46.633308"
      .replace(/-?\d{1,3}\.\d{4,},?\s*-?\d{1,3}\.\d{4,}/g, '[localização omitida]')
      // telefone brasileiro com DDD (+55 opcional)
      .replace(
        /(\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g,
        '[telefone omitido]',
      )
  );
}
