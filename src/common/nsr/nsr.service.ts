import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * NSR (Número Sequencial de Registro) , contador global e monotônico
 * exigido pela Portaria MTP 671/2021 (REP-P). Vive na tabela
 * `afd_nsr` (fora de RLS de propósito , é um contador de sistema, não
 * um dado de um tenant específico, ver Rodada 23).
 *
 * Extraído de dentro de `AfdService` (Rodada 5/Portaria 671) pra ser
 * reaproveitado também pelo Espelho de Ponto REP-P (`RepPService`,
 * Rodada 27) , o MESMO evento (`RegistroJornada`) precisa sempre
 * carregar o MESMO NSR não importa qual relatório o exiba (o AFD
 * oficial ou o espelho de ponto legível), então a chave de origem usada
 * aqui (`registro:<id>`) é intencionalmente idêntica à que o
 * `AfdService` já usava antes desta extração , nenhum NSR já emitido
 * muda de valor com esta mudança.
 */
@Injectable()
export class NsrService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotente: a mesma `chaveOrigem` sempre devolve o mesmo NSR, gerando um novo só na primeira vez. */
  async obterOuCriar(
    chaveOrigem: string,
    tipoRegistro: number,
  ): Promise<number> {
    const existente = await this.prisma.afdNsr.findUnique({
      where: { chaveOrigem },
    });
    if (existente) return existente.nsr;

    const criado = await this.prisma.afdNsr.create({
      data: { chaveOrigem, tipoRegistro },
    });
    return criado.nsr;
  }
}
