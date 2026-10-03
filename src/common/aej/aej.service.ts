import { Injectable } from '@nestjs/common';
import type { Motorista, RegistroJornada } from '@prisma/client';
import type { EmpresaDoComprovante } from '../comprovante/comprovante.service';

/**
 * AEJ , Arquivo Eletrônico de Jornada (nosso export próprio, em CSV).
 *
 * Atualização: o AFD oficial da Portaria MTP 671/2021 (leiaute REP-P,
 * registro tipo 7) JÁ é implementado , ver `AfdService`
 * (common/afd/afd.service.ts) e o endpoint `GET /empresas/afd`. A
 * especificação é pública (texto ASCII de largura fixa, não binário ,
 * ver claude/viabilidade-afd-671.md no projeto), então o motivo
 * original pra não implementar (falta de acesso à especificação byte
 * a byte) não se aplica mais.
 *
 * Este serviço continua existindo porque o CSV cobre a mesma
 * informação de um jeito mais fácil de abrir numa planilha (não é
 * documento fiscal oficial, é conveniência operacional) , cada evento
 * do motorista, com todos os campos legalmente relevantes
 * (identificação, timestamp, geolocalização, hash da cadeia,
 * dispositivo usado). As colunas de empresa usam sempre o CNPJ do
 * vínculo empregatício real do motorista (não necessariamente o único
 * CNPJ do grupo) , mesmo critério do comprovante em PDF, ver o
 * comentário em `ComprovanteService`.
 */
@Injectable()
export class AejService {
  gerarCsv(
    motorista: Motorista,
    empresa: EmpresaDoComprovante,
    registros: RegistroJornada[],
  ): string {
    const linhas: string[] = [];
    linhas.push(
      [
        'motoristaId',
        'nomeMotorista',
        'cpf',
        'cnh',
        'empresaRazaoSocial',
        'empresaCnpj',
        'sequencial',
        'tipoEvento',
        'timestampEvento',
        'latitude',
        'longitude',
        'observacao',
        'hashAnterior',
        'hashAtual',
        'assinaturaDigital',
        'deviceUuidUsado',
      ].join(';'),
    );

    for (const r of registros) {
      linhas.push(
        [
          motorista.id,
          this.escaparCampo(motorista.nome),
          motorista.cpf,
          motorista.cnh,
          this.escaparCampo(empresa.razaoSocial),
          empresa.cnpj,
          String(r.sequencial),
          r.tipoEvento,
          r.timestampEvento.toISOString(),
          r.latitude?.toString() ?? '',
          r.longitude?.toString() ?? '',
          this.escaparCampo(r.observacao ?? ''),
          r.hashAnterior,
          r.hashAtual,
          r.assinaturaDigital ?? '',
          r.deviceUuidUsado,
        ].join(';'),
      );
    }

    // BOM UTF-8 no início , Excel no Windows (o ambiente do usuário)
    // só reconhece acentuação corretamente em CSV com BOM.
    return '﻿' + linhas.join('\r\n') + '\r\n';
  }

  private escaparCampo(valor: string): string {
    if (valor.includes(';') || valor.includes('"') || valor.includes('\n')) {
      return `"${valor.replace(/"/g, '""')}"`;
    }
    return valor;
  }
}
