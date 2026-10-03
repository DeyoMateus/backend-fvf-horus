import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

export interface RegistroParaHash {
  motoristaId: string;
  tipoEvento: string;
  timestampEvento: Date | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  precisaoGpsM?: number | null;
  odometro?: number | null;
  observacao?: string | null;
  sequencial: number;
  deviceUuidUsado: string;
}

/**
 * Ledger append-only com cadeia de hashes (mesmo princípio usado em
 * extratos bancários e livros contábeis imutáveis / blockchains
 * privadas): cada registro carrega o hash do registro anterior, então
 * qualquer alteração ou remoção de um evento no meio da cadeia quebra
 * todos os hashes subsequentes e é detectável em `verificarCadeia`.
 *
 * A cadeia é isolada por motorista (cada motorista tem seu próprio
 * "livro"), iniciando de um hash genesis único gerado no cadastro.
 */
@Injectable()
export class HashChainService {
  /** Hash genesis único do "livro" de um motorista , âncora da cadeia. */
  gerarHashGenesis(input: {
    empresaId: string;
    cpf: string;
    cnh: string;
  }): string {
    const nonce = randomBytes(16).toString('hex');
    return this.sha256(
      `GENESIS|${input.empresaId}|${input.cpf}|${input.cnh}|${nonce}|${Date.now()}`,
    );
  }

  /**
   * Normaliza um valor numérico opcional pra sempre virar o mesmo tipo
   * (number) e a mesma representação no JSON do hash, não importa se
   * quem chamou passou um `number` cru (na criação, vindo do DTO) ou um
   * `Prisma.Decimal` (na verificação, vindo de volta do banco , colunas
   * `Decimal` do Postgres voltam do Prisma como objeto, não como number,
   * e sem isso o mesmo valor gerava dois JSONs diferentes e quebrava a
   * cadeia de hash de todo registro com GPS, mesmo sem nada ter sido
   * alterado). `Number(Decimal)` funciona porque a lib decimal.js usada
   * pelo Prisma implementa `valueOf`/`toString`.
   */
  private paraNumero(valor: unknown): number | null {
    if (valor === null || valor === undefined) return null;
    const n = Number(valor);
    return Number.isNaN(n) ? null : n;
  }

  /** Serialização canônica (chaves ordenadas) para o payload entrar no hash sempre da mesma forma. */
  canonicalizar(payload: RegistroParaHash): string {
    const ordenado = {
      latitude: this.paraNumero(payload.latitude),
      longitude: this.paraNumero(payload.longitude),
      motoristaId: payload.motoristaId,
      deviceUuidUsado: payload.deviceUuidUsado,
      observacao: payload.observacao ?? null,
      // O campo "odometro" foi retirado da COLETA (tela de registro de
      // ponto, DTO, criação de novos registros , Rodada 59), mas continua
      // fazendo parte do payload canônico do hash, lendo o valor real do
      // registro. Registros novos nunca mais preenchem este campo (então
      // sempre entra como null a partir de agora), mas registros antigos
      // que já tinham um valor de odômetro gravado DEPENDEM dele continuar
      // aqui, exatamente como estava, para que o hash recalculado bata com
      // o hashAtual já gravado. Nunca fixar este campo como null a força ,
      // isso quebra a verificação de integridade de qualquer registro
      // antigo que tenha odômetro preenchido (bug real da Rodada 59,
      // corrigido nesta revisão).
      odometro: payload.odometro ?? null,
      precisaoGpsM: payload.precisaoGpsM ?? null,
      sequencial: payload.sequencial,
      timestampEvento: new Date(payload.timestampEvento).toISOString(),
      tipoEvento: payload.tipoEvento,
    };
    return JSON.stringify(ordenado);
  }

  calcularHash(
    hashAnterior: string,
    sequencial: number,
    payload: RegistroParaHash,
  ): string {
    const canonico = this.canonicalizar(payload);
    return this.sha256(`${hashAnterior}|${sequencial}|${canonico}`);
  }

  sha256(valor: string | Buffer): string {
    return createHash('sha256').update(valor).digest('hex');
  }

  /**
   * Reprocessa a cadeia inteira de um motorista e confirma que cada
   * hashAtual bate com o recálculo, e que cada hashAnterior aponta
   * exatamente para o hashAtual do evento anterior (ou para o hash
   * genesis, no primeiro evento).
   */
  verificarCadeia(
    hashGenesis: string,
    registros: Array<{
      sequencial: number;
      hashAnterior: string;
      hashAtual: string;
      motoristaId: string;
      tipoEvento: string;
      timestampEvento: Date;
      latitude: unknown;
      longitude: unknown;
      precisaoGpsM: number | null;
      odometro: number | null;
      observacao: string | null;
      deviceUuidUsado: string;
    }>,
  ): {
    valido: boolean;
    totalRegistros: number;
    primeiraQuebraSequencial?: number;
    motivo?: string;
    /** Pedido do usuário: antes só reportava a PRIMEIRA quebra e parava
     * (early return) , quem olha o relatório não tinha como saber se
     * havia mais de uma divergência, nem dava pra "aceitar" uma sem
     * continuar escondendo as outras. Agora reprocessa a cadeia inteira
     * e devolve TODAS as quebras encontradas, cada uma com seu próprio
     * `sequencial`/`motivo`. */
    quebras: Array<{ sequencial: number; motivo: string }>;
  } {
    const ordenados = [...registros].sort(
      (a, b) => a.sequencial - b.sequencial,
    );
    let hashEsperado = hashGenesis;
    const quebras: Array<{ sequencial: number; motivo: string }> = [];

    for (const registro of ordenados) {
      if (registro.hashAnterior !== hashEsperado) {
        quebras.push({
          sequencial: registro.sequencial,
          motivo:
            'hashAnterior não corresponde ao hash do evento anterior (possível remoção/inserção)',
        });
        // Segue a cadeia a partir do que está REALMENTE gravado (não do
        // que seria esperado), pra continuar conseguindo avaliar os
        // eventos seguintes de forma independente, em vez de todo o
        // resto da lista virar uma cascata de "quebra" por causa de uma
        // única divergência estrutural no meio.
        hashEsperado = registro.hashAtual;
        continue;
      }

      const hashRecalculado = this.calcularHash(
        registro.hashAnterior,
        registro.sequencial,
        {
          motoristaId: registro.motoristaId,
          tipoEvento: registro.tipoEvento,
          timestampEvento: registro.timestampEvento,
          latitude: registro.latitude as number | null,
          longitude: registro.longitude as number | null,
          precisaoGpsM: registro.precisaoGpsM,
          odometro: registro.odometro,
          observacao: registro.observacao,
          sequencial: registro.sequencial,
          deviceUuidUsado: registro.deviceUuidUsado,
        },
      );

      if (hashRecalculado !== registro.hashAtual) {
        quebras.push({
          sequencial: registro.sequencial,
          motivo:
            'hashAtual não corresponde ao recálculo (evento foi alterado)',
        });
      }

      hashEsperado = registro.hashAtual;
    }

    return {
      valido: quebras.length === 0,
      totalRegistros: ordenados.length,
      primeiraQuebraSequencial: quebras[0]?.sequencial,
      motivo: quebras[0]?.motivo,
      quebras,
    };
  }
}
