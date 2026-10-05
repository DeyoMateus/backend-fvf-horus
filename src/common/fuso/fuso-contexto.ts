import { AsyncLocalStorage } from 'node:async_hooks';
import {
  OFFSET_PADRAO_MIN,
  formatarDataHoraBrt,
  rotuloFuso,
} from './fuso-brasil.util';

/**
 * Rodada 149: fuso do computador de quem fez a requisição (header
 * `x-fuso-offset-min`), disponível em qualquer ponto da requisição sem mudar
 * assinaturas. Os PDFs usam para escrever "Gerado em" na hora de quem gerou.
 * Fora de uma requisição (jobs), cai em Brasília.
 */
const armazenamento = new AsyncLocalStorage<{ offsetMin: number }>();

export function executarComFusoDoCliente<T>(
  offsetMin: number,
  fn: () => T,
): T {
  return armazenamento.run({ offsetMin }, fn);
}

export function offsetDoCliente(): number {
  return armazenamento.getStore()?.offsetMin ?? OFFSET_PADRAO_MIN;
}

/** "05/10/2026 07:00 (UTC-3)" na hora de quem está gerando o documento. */
export function agoraDoCliente(): string {
  const off = offsetDoCliente();
  return `${formatarDataHoraBrt(new Date(), off)} (${rotuloFuso(off)})`;
}

/** Instante na hora de quem gera o documento, com o rótulo do fuso. */
export function instanteDoCliente(data: Date): string {
  const off = offsetDoCliente();
  return `${formatarDataHoraBrt(data, off)} (${rotuloFuso(off)})`;
}

/**
 * Hora de um ponto batido: no fuso em que o MOTORISTA estava (offset gravado
 * no registro). O rótulo "(UTC-x)" aparece quando difere do fuso de quem gera.
 */
export function instanteDoEvento(
  data: Date,
  offsetEventoMin?: number | null,
): string {
  if (offsetEventoMin == null) return instanteDoCliente(data);
  const texto = formatarDataHoraBrt(data, offsetEventoMin);
  return offsetEventoMin === offsetDoCliente()
    ? texto
    : `${texto} (${rotuloFuso(offsetEventoMin)})`;
}
