import { jest } from '@test/jest-globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { UsuariosEmpresaService } from './usuarios-empresa.service';

/**
 * Isolamento entre grupos e Regras sindicais do UsuariosEmpresaService
 * (Rodada 31) , mesmo padrão de instanciação direta com mocks
 * posicionais já usado no resto do projeto (ver EmpresasService, que
 * também não delega para TenantService: o tenant aqui é o próprio
 * Grupo, checado inline em `atualizarStatus`).
 */
describe('UsuariosEmpresaService', () => {
  function criarServiceComPrismaMock(
    usuarioExistente: { id: string; email?: string; grupoId: string } | null,
  ) {
    const prismaMock = {
      usuarioEmpresa: {
        findUnique: jest.fn().mockResolvedValue(usuarioExistente),
        create: jest.fn().mockResolvedValue({
          id: 'novo-usuario',
          nome: 'Fulano',
          email: 'fulano@empresa.com',
          papel: PapelUsuario.GESTOR,
          ativo: true,
          telefoneWhatsapp: null,
          createdAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'usuario-1', ativo: false }),
      },
    } as any;
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new UsuariosEmpresaService(prismaMock, auditMock);
    return { service, prismaMock, auditMock };
  }

  const dto = {
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    senha: 'senha12345',
    papel: PapelUsuario.GESTOR,
  } as any;

  describe('create', () => {
    it('lança ConflictException quando o e-mail já existe', async () => {
      const { service } = criarServiceComPrismaMock({
        id: 'x',
        grupoId: 'grupo-A',
      });
      await expect(service.create(dto, 'grupo-A', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('cria o usuário vinculado ao grupo de quem está pedindo, nunca a outro', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock(null);
      await service.create(dto, 'grupo-A', 'admin-1');
      expect(prismaMock.usuarioEmpresa.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grupoId: 'grupo-A',
            papel: PapelUsuario.GESTOR,
          }),
        }),
      );
    });
  });

  describe('list', () => {
    it('filtra sempre pelo grupoId de quem está pedindo', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock(null);
      await service.list('grupo-A');
      expect(prismaMock.usuarioEmpresa.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { grupoId: 'grupo-A' } }),
      );
    });
  });

  describe('atualizarStatus', () => {
    it('lança ForbiddenException quando o usuário tenta alterar o próprio status', async () => {
      const { service } = criarServiceComPrismaMock({
        id: 'admin-1',
        grupoId: 'grupo-A',
      });
      await expect(
        service.atualizarStatus(
          'admin-1',
          { ativo: false },
          'grupo-A',
          'admin-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando o usuário pertence a outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        id: 'usuario-1',
        grupoId: 'grupo-B',
      });
      await expect(
        service.atualizarStatus(
          'usuario-1',
          { ativo: false },
          'grupo-A',
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('desativa um usuário do mesmo grupo com sucesso', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock({
        id: 'usuario-1',
        grupoId: 'grupo-A',
      });
      await service.atualizarStatus(
        'usuario-1',
        { ativo: false },
        'grupo-A',
        'admin-1',
      );
      expect(prismaMock.usuarioEmpresa.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usuario-1' },
          data: { ativo: false },
        }),
      );
    });
  });
});
