import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

/**
 * Testa o único lugar que decide "isto pertence ao grupo de quem está
 * pedindo?" pra TODO o backend (motoristas, empresas, documentos de
 * carga, dispositivos, tratamentos de ponto, alertas de jornada , ver
 * comentário da classe). Um bug aqui vaza pra todo mundo que usa este
 * service, então esta é a suíte com maior retorno de toda a auditoria
 * de tenant isolation.
 */
describe('TenantService', () => {
  function criarService(prismaMock: any) {
    return new TenantService(prismaMock);
  }

  describe('verificarEmpresaNoGrupo', () => {
    it('lança NotFoundException quando a empresa não existe', async () => {
      const prisma = {
        empresa: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarEmpresaNoGrupo('empresa-x', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando a empresa pertence a outro grupo', async () => {
      const prisma = {
        empresa: {
          findUnique: jest.fn().mockResolvedValue({ grupoId: 'grupo-B' }),
        },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarEmpresaNoGrupo('empresa-x', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('resolve sem erro quando a empresa pertence ao grupo do solicitante', async () => {
      const prisma = {
        empresa: {
          findUnique: jest.fn().mockResolvedValue({ grupoId: 'grupo-A' }),
        },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarEmpresaNoGrupo('empresa-x', 'grupo-A'),
      ).resolves.toBeUndefined();
    });
  });

  describe('verificarMotoristaNoGrupo', () => {
    it('lança NotFoundException quando o motorista não existe', async () => {
      const prisma = {
        motorista: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarMotoristaNoGrupo('motorista-x', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const prisma = {
        motorista: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              empresaId: 'empresa-B',
              empresa: { grupoId: 'grupo-B' },
            }),
        },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarMotoristaNoGrupo('motorista-x', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devolve o empresaId real quando o motorista pertence ao grupo do solicitante', async () => {
      const prisma = {
        motorista: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              empresaId: 'empresa-A',
              empresa: { grupoId: 'grupo-A' },
            }),
        },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarMotoristaNoGrupo('motorista-x', 'grupo-A'),
      ).resolves.toEqual({
        empresaId: 'empresa-A',
      });
    });
  });

  describe('verificarDocumentoCargaNoGrupo', () => {
    it('lança NotFoundException quando o documento não existe', async () => {
      const prisma = {
        documentoCarga: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarDocumentoCargaNoGrupo('doc-x', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o documento pertence a uma empresa de outro grupo', async () => {
      const prisma = {
        documentoCarga: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              empresaId: 'empresa-B',
              empresa: { grupoId: 'grupo-B' },
            }),
        },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarDocumentoCargaNoGrupo('doc-x', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devolve o empresaId real quando o documento pertence ao grupo do solicitante', async () => {
      const prisma = {
        documentoCarga: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              empresaId: 'empresa-A',
              empresa: { grupoId: 'grupo-A' },
            }),
        },
      };
      const service = criarService(prisma);
      await expect(
        service.verificarDocumentoCargaNoGrupo('doc-x', 'grupo-A'),
      ).resolves.toEqual({
        empresaId: 'empresa-A',
      });
    });
  });
});
