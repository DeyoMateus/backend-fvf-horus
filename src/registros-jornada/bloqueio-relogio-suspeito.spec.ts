import { jest } from '@test/jest-globals';
import { BadRequestException } from '@nestjs/common';
import { RegistrosJornadaService } from './registros-jornada.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TenantContext } from '../common/tenant/tenant-context';
import type { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';

/**
 * Rodada 87 , pedido do usuário: "o app ainda continua levando em
 * consideração a hora do aparelho, se mudar a hora já roda o
 * cronômetro e aceita bater o ponto (...) o sistema não pode aceitar
 * fraudes, não deve ser possível bater o ponto se estiver com suspeita
 * de fraude desse tipo". Antes desta rodada, `AntifraudeService` só
 * SINALIZAVA relógio adiantado (`RELOGIO_DISPOSITIVO_SUSPEITO`), nunca
 * bloqueava , este teste cobre o bloqueio de verdade adicionado em
 * `RegistrosJornadaService.create`, ANTES de qualquer gravação no
 * ledger (nenhum `sequencial`/hash é consumido numa tentativa
 * rejeitada).
 *
 * Rodada 88 , acrescenta o bloqueio por divergência de relógio
 * MONOTÔNICO (elapsedRealtime/systemUptime), pedido do usuário depois
 * de conseguir a build EAS: pega especificamente o ataque que os dois
 * bloqueios da Rodada 87 não pegavam (adiantar o relógio ALGUMAS HORAS
 * pra um horário passado plausível e bater offline).
 */
describe('RegistrosJornadaService.create , bloqueio de relógio de aparelho suspeito', () => {
  const MOTORISTA_MOCK = {
    id: 'motorista-1',
    empresaId: 'empresa-A',
    hashGenesis: 'genesis-x',
    certificadoPfxEnc: Buffer.from('pfx'),
    certificadoIv: 'iv',
    certificadoAuthTag: 'tag',
  };

  function criarServiceEDeps(
    ultimoRegistro: {
      sequencial: number;
      timestampEvento: Date;
      hashAtual: string;
      deviceUuidUsado?: string;
      elapsedRealtimeMs?: number | null;
    } | null,
  ) {
    const txMock = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      registroJornada: {
        findUnique: jest.fn().mockResolvedValue(null), // checagem de idempotencyKey , dto de teste não usa
        findFirst: jest.fn().mockResolvedValue(ultimoRegistro),
        create: jest.fn(),
      },
      motorista: { findUnique: jest.fn().mockResolvedValue(MOTORISTA_MOCK) },
      // Rodada 137: amostra de hora confiável do servidor (nenhuma nos testes).
      amostraHoraConfiavel: { findFirst: jest.fn().mockResolvedValue(null) },
      // Rodada 92: evento sem amostra do mesmo boot fica pendente de reavaliação.
      verificacaoRelogioPendente: { create: jest.fn().mockResolvedValue({}) },
    };

    const prismaMock = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(txMock)),
    } as any;

    const auditMock = { registrar: jest.fn().mockResolvedValue(undefined) };
    const tenant = new TenantService(prismaMock);

    const service = new RegistrosJornadaService(
      prismaMock,
      {} as any, // hashChain , não alcançado numa rejeição
      {} as any, // crypto
      {} as any, // certificados
      {} as any, // assinaturas
      auditMock as any,
      {} as any, // jornadaLegal
      {} as any, // antifraude
      {} as any, // pushNotifications
      {} as any, // whatsapp
      tenant,
    );

    return { service, txMock, prismaMock, auditMock };
  }

  function dto(
    timestampEvento: string,
    elapsedRealtimeMs?: number,
  ): CreateRegistroJornadaDto {
    return {
      tipoEvento: 'FIM_JORNADA',
      timestampEvento,
      elapsedRealtimeMs,
    } as CreateRegistroJornadaDto;
  }

  it('rejeita quando o novo evento tem horário igual ou anterior ao último registro do motorista (relógio andando pra trás)', async () => {
    const ultimoRegistro = {
      sequencial: 5,
      timestampEvento: new Date('2026-09-30T21:39:00Z'),
      hashAtual: 'hash-5',
    };
    const { service, txMock, auditMock } = criarServiceEDeps(ultimoRegistro);

    // "Fim de jornada" batido com horário ANTERIOR ao último evento já
    // gravado (mesmo caso relatado pelo usuário: "Fim de descanso"
    // gravado às 21:39, seguido de "Fim de jornada" às 16:40).
    await TenantContext.paraGrupo('00000000-0000-4000-8000-00000000000a', () =>
      expect(
        service.create(
          'motorista-1',
          'device-1',
          dto('2026-09-30T16:40:53.000Z'),
        ),
      ).rejects.toThrow(BadRequestException),
    );

    expect(txMock.registroJornada.create).not.toHaveBeenCalled();
    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'REGISTRO_REJEITADO_RELOGIO_RETROCEDIDO',
      }),
    );
  });

  it('rejeita quando o relógio do aparelho está adiantado além da tolerância em relação ao horário do servidor', async () => {
    const { service, txMock, auditMock } = criarServiceEDeps(null); // primeiro evento do motorista

    const daqui30min = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await TenantContext.paraGrupo('00000000-0000-4000-8000-00000000000a', () =>
      expect(
        service.create('motorista-1', 'device-1', dto(daqui30min)),
      ).rejects.toThrow(BadRequestException),
    );

    expect(txMock.registroJornada.create).not.toHaveBeenCalled();
    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'REGISTRO_REJEITADO_RELOGIO_ADIANTADO' }),
    );
  });

  it('NÃO rejeita por relógio quando o horário está dentro da tolerância normal de deriva (poucos minutos)', async () => {
    const ultimoRegistro = {
      sequencial: 5,
      timestampEvento: new Date(Date.now() - 60 * 60 * 1000),
      hashAtual: 'hash-5',
    };
    const { service, txMock, auditMock } = criarServiceEDeps(ultimoRegistro);

    // Spies nos avaliadores de alerta (métodos privados da própria
    // classe) , o foco deste teste é só confirmar que a checagem NOVA
    // de relógio não bloqueia um registro normal, não re-testar o motor
    // de alertas legais/antifraude (já coberto em outros specs).
    jest.spyOn(service as any, 'avaliarLimitesLegais').mockResolvedValue([]);
    jest.spyOn(service as any, 'avaliarAntifraude').mockResolvedValue([]);
    jest.spyOn(service as any, 'avaliarFolgaConflitante').mockResolvedValue([]);
    jest
      .spyOn(service as any, 'avaliarDescarregamento')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'avaliarCteAbertoSemVinculoRecente')
      .mockResolvedValue(null);
    jest
      .spyOn(service as any, 'agendarProximaVerificacaoSeAplicavel')
      .mockResolvedValue(undefined);
    (service as any).hashChain = {
      calcularHash: jest.fn().mockReturnValue('hash-6'),
    };
    (service as any).crypto = {
      decrypt: jest.fn().mockReturnValue(Buffer.from('pfx-decifrado')),
    };
    (service as any).certificados = {
      decodificar: jest.fn().mockReturnValue({ privateKey: 'chave' }),
    };
    (service as any).assinaturas = {
      assinar: jest.fn().mockReturnValue('assinatura'),
    };

    txMock.registroJornada.create.mockResolvedValue({
      id: 'registro-6',
      sequencial: 6,
      timestampEvento: new Date(),
    });

    const agora = new Date().toISOString();
    await TenantContext.paraGrupo('00000000-0000-4000-8000-00000000000a', () =>
      service.create('motorista-1', 'device-1', dto(agora)),
    );

    expect(txMock.registroJornada.create).toHaveBeenCalledTimes(1);
    expect(auditMock.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'REGISTRO_REJEITADO_RELOGIO_RETROCEDIDO',
      }),
    );
    expect(auditMock.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'REGISTRO_REJEITADO_RELOGIO_ADIANTADO' }),
    );
  });

  it('rejeita por relógio MONOTÔNICO divergente quando o mesmo aparelho não reiniciou entre os dois toques (Rodada 88)', async () => {
    // Último evento: 10:00 de parede, elapsedRealtime = 100_000ms (mesmo device).
    const ultimoRegistro = {
      sequencial: 5,
      timestampEvento: new Date('2026-09-30T10:00:00.000Z'),
      hashAtual: 'hash-5',
      deviceUuidUsado: 'device-1',
      elapsedRealtimeMs: 100_000,
    };
    const { service, txMock, auditMock } = criarServiceEDeps(ultimoRegistro);

    // Novo evento: relógio de PAREDE avançou 8h (adiantado manualmente),
    // mas o monotônico só avançou 1 minuto (60_000ms) , divergência de
    // quase 8h, muito além da tolerância de 5min. Aparelho não
    // reiniciou (elapsedRealtimeMs novo > anterior).
    await TenantContext.paraGrupo('00000000-0000-4000-8000-00000000000a', () =>
      expect(
        service.create(
          'motorista-1',
          'device-1',
          dto('2026-09-30T18:00:00.000Z', 100_000 + 60_000),
        ),
      ).rejects.toThrow(BadRequestException),
    );

    expect(txMock.registroJornada.create).not.toHaveBeenCalled();
    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'REGISTRO_REJEITADO_RELOGIO_MONOTONICO_DIVERGENTE',
      }),
    );
  });

  it('NÃO aplica a checagem de relógio monotônico quando o aparelho reiniciou entre os dois toques (elapsedRealtime voltou a um valor menor)', async () => {
    const ultimoRegistro = {
      sequencial: 5,
      timestampEvento: new Date(Date.now() - 60 * 60 * 1000),
      hashAtual: 'hash-5',
      deviceUuidUsado: 'device-1',
      elapsedRealtimeMs: 500_000, // aparelho ficou ligado bastante tempo antes de reiniciar
    };
    const { service, txMock, auditMock } = criarServiceEDeps(ultimoRegistro);

    jest.spyOn(service as any, 'avaliarLimitesLegais').mockResolvedValue([]);
    jest.spyOn(service as any, 'avaliarAntifraude').mockResolvedValue([]);
    jest.spyOn(service as any, 'avaliarFolgaConflitante').mockResolvedValue([]);
    jest
      .spyOn(service as any, 'avaliarDescarregamento')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'avaliarCteAbertoSemVinculoRecente')
      .mockResolvedValue(null);
    jest
      .spyOn(service as any, 'agendarProximaVerificacaoSeAplicavel')
      .mockResolvedValue(undefined);
    (service as any).hashChain = {
      calcularHash: jest.fn().mockReturnValue('hash-6'),
    };
    (service as any).crypto = {
      decrypt: jest.fn().mockReturnValue(Buffer.from('pfx-decifrado')),
    };
    (service as any).certificados = {
      decodificar: jest.fn().mockReturnValue({ privateKey: 'chave' }),
    };
    (service as any).assinaturas = {
      assinar: jest.fn().mockReturnValue('assinatura'),
    };

    txMock.registroJornada.create.mockResolvedValue({
      id: 'registro-6',
      sequencial: 6,
      timestampEvento: new Date(),
    });

    // elapsedRealtimeMs MENOR que o do último registro , só acontece se
    // o aparelho reiniciou no meio (não dá pra comparar monotônico
    // através de um reboot). A checagem deve ser pulada, mesmo o app
    // trazendo um valor.
    const agora = new Date().toISOString();
    await TenantContext.paraGrupo('00000000-0000-4000-8000-00000000000a', () =>
      service.create('motorista-1', 'device-1', dto(agora, 1_000)),
    );

    expect(txMock.registroJornada.create).toHaveBeenCalledTimes(1);
    expect(auditMock.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'REGISTRO_REJEITADO_RELOGIO_MONOTONICO_DIVERGENTE',
      }),
    );
  });
});
