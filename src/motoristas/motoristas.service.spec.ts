import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MotoristasService } from './motoristas.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Isolamento entre grupos para MotoristasService: um usuário do grupo A
 * não pode ler dados (perfil, alertas de integridade de dispositivo) de
 * um motorista de uma empresa que pertence ao grupo B, trocando o id na
 * URL. Cobre `findById` e `listarAlertasIntegridadeDispositivo`, que
 * delegam a checagem para `TenantService.verificarMotoristaNoGrupo`
 * antes de qualquer leitura.
 */
describe('MotoristasService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const motoristaCompleto = motorista && {
      id: 'motorista-1',
      nome: 'Fulano',
      cpf: '12345678900',
      cnh: '123456789',
      status: 'ATIVO',
      empresaId: motorista.empresaId,
      hashGenesis: 'hash-x',
      certificadoFingerprint: 'fp-x',
      certificadoValidoAte: null,
      createdAt: null,
      updatedAt: null,
      dispositivoVinculado: null,
      empresa: motorista.empresa,
    };

    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motoristaCompleto) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const tenant = new TenantService(prismaMock);

    // Só `prisma`/`tenant` são usados pelos métodos testados; os demais
    // providers do construtor (hashChain, certificados, crypto, audit)
    // não entram nesse caminho de código.
    const service = new MotoristasService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      tenant,
    );
    return { service, prismaMock };
  }

  describe('findById', () => {
    it('lança NotFoundException quando o motorista não existe', async () => {
      const { service } = criarServiceComPrismaMock(null);
      await expect(
        service.findById('motorista-inexistente', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-B',
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(service.findById('motorista-1', 'grupo-A')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('devolve o motorista quando ele pertence a uma empresa do grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });
      const resultado = await service.findById('motorista-1', 'grupo-A');
      expect(resultado).toMatchObject({
        id: 'motorista-1',
        empresaId: 'empresa-A',
      });
    });
  });

  describe('listarAlertasIntegridadeDispositivo', () => {
    it('lança NotFoundException quando o motorista não existe', async () => {
      const { service } = criarServiceComPrismaMock(null);
      await expect(
        service.listarAlertasIntegridadeDispositivo(
          'motorista-inexistente',
          'grupo-A',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-B',
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(
        service.listarAlertasIntegridadeDispositivo('motorista-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a consulta quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });
      const resultado = await service.listarAlertasIntegridadeDispositivo(
        'motorista-1',
        'grupo-A',
      );
      expect(resultado).toEqual([]);
    });
  });
});
