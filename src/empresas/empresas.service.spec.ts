import { jest } from '@test/jest-globals';
import { ForbiddenException } from '@nestjs/common';
import { EmpresasService } from './empresas.service';

/**
 * Isolamento entre grupos para EmpresasService. Diferente dos outros
 * services, este NÃO delega para `TenantService` , o tenant aqui é o
 * próprio Grupo, então `findById`/`list` fazem a checagem inline
 * (`empresa.grupoId !== grupoIdSolicitante`). Testamos essa lógica
 * inline diretamente, já que não há um TenantService por trás dela.
 */
describe('EmpresasService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(
    empresa: { id: string; grupoId: string } | null,
  ) {
    const prismaMock = {
      empresa: {
        findUnique: jest.fn().mockResolvedValue(empresa),
        findMany: jest.fn().mockResolvedValue(empresa ? [empresa] : []),
      },
    } as any;

    const service = new EmpresasService(prismaMock, {} as any);
    return { service, prismaMock };
  }

  describe('findById', () => {
    it('lança ForbiddenException quando a empresa não existe', async () => {
      const { service } = criarServiceComPrismaMock(null);
      await expect(
        service.findById('empresa-inexistente', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança ForbiddenException quando a empresa pertence a outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        id: 'empresa-1',
        grupoId: 'grupo-B',
      });
      await expect(service.findById('empresa-1', 'grupo-A')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('devolve a empresa quando ela pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        id: 'empresa-1',
        grupoId: 'grupo-A',
      });
      const resultado = await service.findById('empresa-1', 'grupo-A');
      expect(resultado).toMatchObject({ id: 'empresa-1', grupoId: 'grupo-A' });
    });
  });

  describe('list', () => {
    it('filtra sempre pelo grupoId de quem está pedindo, nunca lista todos os grupos', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock({
        id: 'empresa-1',
        grupoId: 'grupo-A',
      });
      await service.list('grupo-A');
      expect(prismaMock.empresa.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { grupoId: 'grupo-A' } }),
      );
    });
  });
});
