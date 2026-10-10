import { jest } from '@test/jest-globals';
import { BadRequestException } from '@nestjs/common';
import { TratamentosPontoService } from './tratamentos-ponto.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Rodada 193: lançar a jornada inteira de uma vez. Garante que a sequência
 * é validada ANTES de gravar qualquer evento (nada fica pela metade) e que
 * cada evento vira um TratamentoPonto comum.
 */
describe('TratamentosPontoService , createJornada', () => {
  function criar() {
    const prismaMock = {
      motorista: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'motorista-1',
          nome: 'Motorista Teste',
          status: 'ATIVO',
          excluidoEm: null,
          hashGenesis: 'genesis-x',
          empresaId: 'empresa-A',
          empresa: { grupoId: 'grupo-A' },
        }),
      },
      usuarioEmpresa: {
        findUnique: jest.fn().mockResolvedValue({ id: 'usuario-1' }),
      },
      registroJornada: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      tratamentoPonto: {
        create: jest.fn().mockResolvedValue({ id: 'trat-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    const tenant = new TenantService(prismaMock);
    const service = new TratamentosPontoService(
      prismaMock,
      { sha256: jest.fn().mockReturnValue('hash-x') } as any,
      { registrar: jest.fn().mockResolvedValue(undefined) } as any,
      tenant,
      { configurado: jest.fn().mockReturnValue(false) } as any,
      { notificarMotorista: jest.fn().mockResolvedValue(undefined) } as any,
      {
        verificarEAgendarProximoMotorista: jest
          .fn()
          .mockResolvedValue(undefined),
      } as any,
    );
    return { service, prismaMock };
  }

  const h = (hora: number, min = 0) =>
    new Date(Date.UTC(2026, 9, 5, hora, min)).toISOString();
  const motivo = 'Motorista esqueceu de registrar a jornada';

  it('grava um tratamento por evento quando a jornada é válida', async () => {
    const { service, prismaMock } = criar();
    const r = await service.createJornada(
      'motorista-1',
      {
        motivo,
        eventos: [
          { tipoEvento: 'INICIO_JORNADA', timestampEvento: h(8) },
          { tipoEvento: 'INICIO_DIRECAO', timestampEvento: h(8, 10) },
          { tipoEvento: 'FIM_DIRECAO', timestampEvento: h(12) },
          { tipoEvento: 'INICIO_DESCANSO', timestampEvento: h(12, 5) },
          { tipoEvento: 'FIM_DESCANSO', timestampEvento: h(13) },
          { tipoEvento: 'FIM_JORNADA', timestampEvento: h(17) },
        ],
      } as any,
      'usuario-1',
      'grupo-A',
    );
    expect(r).toHaveLength(6);
    expect(prismaMock.tratamentoPonto.create).toHaveBeenCalledTimes(6);
  });

  it('recusa sem Início de jornada e sem Fim de jornada, sem gravar nada', async () => {
    const { service, prismaMock } = criar();
    await expect(
      service.createJornada(
        'motorista-1',
        {
          motivo,
          eventos: [
            { tipoEvento: 'INICIO_DIRECAO', timestampEvento: h(8) },
            { tipoEvento: 'FIM_JORNADA', timestampEvento: h(17) },
          ],
        } as any,
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createJornada(
        'motorista-1',
        {
          motivo,
          eventos: [
            { tipoEvento: 'INICIO_JORNADA', timestampEvento: h(8) },
            { tipoEvento: 'FIM_DIRECAO', timestampEvento: h(17) },
          ],
        } as any,
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.tratamentoPonto.create).not.toHaveBeenCalled();
  });

  it('recusa horários fora de ordem', async () => {
    const { service, prismaMock } = criar();
    await expect(
      service.createJornada(
        'motorista-1',
        {
          motivo,
          eventos: [
            { tipoEvento: 'INICIO_JORNADA', timestampEvento: h(9) },
            { tipoEvento: 'FIM_JORNADA', timestampEvento: h(8) },
          ],
        } as any,
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(/depois do evento/);
    expect(prismaMock.tratamentoPonto.create).not.toHaveBeenCalled();
  });

  it('recusa sequência inválida (dois inícios de direção seguidos) sem gravar nada', async () => {
    const { service, prismaMock } = criar();
    await expect(
      service.createJornada(
        'motorista-1',
        {
          motivo,
          eventos: [
            { tipoEvento: 'INICIO_JORNADA', timestampEvento: h(8) },
            { tipoEvento: 'INICIO_DIRECAO', timestampEvento: h(9) },
            { tipoEvento: 'INICIO_DIRECAO', timestampEvento: h(10) },
            { tipoEvento: 'FIM_JORNADA', timestampEvento: h(17) },
          ],
        } as any,
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.tratamentoPonto.create).not.toHaveBeenCalled();
  });

  it('recusa jornada acima de 48 horas', async () => {
    const { service } = criar();
    await expect(
      service.createJornada(
        'motorista-1',
        {
          motivo,
          eventos: [
            { tipoEvento: 'INICIO_JORNADA', timestampEvento: h(8) },
            {
              tipoEvento: 'FIM_JORNADA',
              timestampEvento: new Date(
                Date.UTC(2026, 9, 8, 8),
              ).toISOString(),
            },
          ],
        } as any,
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(/48 horas/);
  });
});
