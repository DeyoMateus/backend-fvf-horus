import { jest } from '@test/jest-globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { SuperAdminService } from './super-admin.service';

/**
 * `SuperAdminService.criarEmpresaMae` é o único jeito de uma empresa
 * ganhar conta no sistema (Rodada 31) , testamos que ela recusa CNPJ/
 * e-mail duplicado ANTES de tentar a transação, e que a transação
 * array recebe o SET LOCAL como sistema + os três creates com o mesmo
 * grupoId gerado. `listarGrupos`/`obterGrupo` são testados pela forma
 * como agregam `_count`, não pelo SQL em si (mockado).
 */
describe('SuperAdminService', () => {
  function criarServiceComPrismaMock(opts: {
    empresaExistente?: unknown;
    adminExistente?: unknown;
    grupos?: unknown[];
    grupoDetalhe?: unknown;
    grupoParaAtualizar?: unknown;
    empresaParaAtualizar?: unknown;
    empresaComMesmoCnpj?: unknown;
    usuarioParaAtualizar?: unknown;
    usuarioComMesmoEmail?: unknown;
  }) {
    const transactionMock = jest
      .fn()
      .mockImplementation(async (ops: unknown[]) => {
        // Simula o array [SET LOCAL, grupo, empresa, admin] já resolvido.
        return [
          undefined,
          {
            id: 'grupo-novo',
            razaoSocial: 'Transportadora Exemplo',
            createdAt: new Date(),
          },
          {
            id: 'empresa-nova',
            razaoSocial: 'Transportadora Exemplo Matriz',
            cnpj: '12345678000199',
            grupoId: 'grupo-novo',
          },
          {
            id: 'admin-novo',
            nome: 'Admin Novo',
            email: 'admin@exemplo.com',
            papel: PapelUsuario.ADMIN,
            ativo: true,
            createdAt: new Date(),
          },
        ];
      });

    const empresaFindUnique = jest
      .fn()
      .mockImplementation(async (args: any) => {
        if (args?.where?.cnpj !== undefined) {
          return opts.empresaExistente ?? opts.empresaComMesmoCnpj ?? null;
        }
        return opts.empresaParaAtualizar ?? null;
      });
    const usuarioFindUnique = jest
      .fn()
      .mockImplementation(async (args: any) => {
        if (args?.where?.email !== undefined) {
          return opts.adminExistente ?? opts.usuarioComMesmoEmail ?? null;
        }
        return opts.usuarioParaAtualizar ?? null;
      });

    const prismaMock = {
      empresa: {
        findUnique: empresaFindUnique,
        update: jest
          .fn()
          .mockImplementation(async (args: any) => ({
            ...(opts.empresaParaAtualizar as any),
            ...args.data,
          })),
      },
      usuarioEmpresa: {
        findUnique: usuarioFindUnique,
        update: jest
          .fn()
          .mockImplementation(async (args: any) => ({
            ...(opts.usuarioParaAtualizar as any),
            ...args.data,
          })),
      },
      grupo: {
        findMany: jest.fn().mockResolvedValue(opts.grupos ?? []),
        findUnique: jest
          .fn()
          .mockResolvedValue(
            opts.grupoDetalhe ?? opts.grupoParaAtualizar ?? null,
          ),
        update: jest
          .fn()
          .mockImplementation(async (args: any) => ({
            ...(opts.grupoParaAtualizar as any),
            ...args.data,
          })),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $transaction: transactionMock,
      cru: {
        grupo: { create: jest.fn() },
        empresa: { create: jest.fn() },
        usuarioEmpresa: { create: jest.fn() },
      },
    } as any;
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new SuperAdminService(prismaMock, auditMock);
    return { service, prismaMock, auditMock, transactionMock };
  }

  const dto = {
    razaoSocialGrupo: 'Transportadora Exemplo',
    cnpjEmpresa: '12345678000199',
    razaoSocialEmpresa: 'Transportadora Exemplo Matriz',
    nomeAdmin: 'Admin Novo',
    emailAdmin: 'admin@exemplo.com',
    senhaAdmin: 'senhaSegura123',
  } as any;

  describe('criarEmpresaMae', () => {
    it('lança ConflictException quando o CNPJ já existe', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaExistente: { id: 'x' },
      });
      await expect(service.criarEmpresaMae(dto, 'super-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança ConflictException quando o e-mail do admin já existe', async () => {
      const { service } = criarServiceComPrismaMock({
        adminExistente: { id: 'x' },
      });
      await expect(service.criarEmpresaMae(dto, 'super-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('provisiona grupo + empresa + admin numa única transação e audita', async () => {
      const { service, transactionMock, auditMock } = criarServiceComPrismaMock(
        {},
      );
      const resultado = await service.criarEmpresaMae(dto, 'super-1');

      expect(transactionMock).toHaveBeenCalledTimes(1);
      const operacoesPassadas = transactionMock.mock.calls[0][0] as unknown[];
      expect(operacoesPassadas).toHaveLength(4); // SET LOCAL + grupo + empresa + admin

      expect(resultado.grupo.id).toBe('grupo-novo');
      expect(resultado.empresa.cnpj).toBe('12345678000199');
      expect(resultado.admin.email).toBe('admin@exemplo.com');
      expect(auditMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'EMPRESA_MAE_PROVISIONADA',
          entidadeId: 'grupo-novo',
        }),
      );
    });
  });

  describe('listarGrupos', () => {
    it('soma o total de motoristas de todas as empresas de cada grupo', async () => {
      const grupos = [
        {
          id: 'grupo-A',
          razaoSocial: 'Grupo A',
          createdAt: new Date(),
          _count: { empresas: 2, usuarios: 3 },
          empresas: [
            { _count: { motoristas: 5 } },
            { _count: { motoristas: 7 } },
          ],
        },
      ];
      const { service } = criarServiceComPrismaMock({ grupos });
      const resultado = await service.listarGrupos();
      expect(resultado).toEqual([
        {
          id: 'grupo-A',
          razaoSocial: 'Grupo A',
          createdAt: grupos[0].createdAt,
          totalEmpresas: 2,
          totalUsuarios: 3,
          totalMotoristas: 12,
        },
      ]);
    });
  });

  describe('obterGrupo', () => {
    it('lança NotFoundException quando o grupo não existe', async () => {
      const { service } = criarServiceComPrismaMock({ grupoDetalhe: null });
      await expect(service.obterGrupo('grupo-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devolve empresas com contagem de motoristas e a lista de usuários', async () => {
      const grupoDetalhe = {
        id: 'grupo-A',
        razaoSocial: 'Grupo A',
        createdAt: new Date(),
        empresas: [
          {
            id: 'empresa-1',
            razaoSocial: 'Filial 1',
            cnpj: '111',
            ativo: true,
            registroInpiAfd: null,
            _count: { motoristas: 4 },
          },
        ],
        usuarios: [
          {
            id: 'usuario-1',
            nome: 'Gestor 1',
            email: 'g1@a.com',
            papel: PapelUsuario.GESTOR,
            ativo: true,
            createdAt: new Date(),
          },
        ],
      };
      const { service } = criarServiceComPrismaMock({ grupoDetalhe });
      const resultado = await service.obterGrupo('grupo-A');
      expect(resultado.empresas).toEqual([
        {
          id: 'empresa-1',
          razaoSocial: 'Filial 1',
          cnpj: '111',
          ativo: true,
          registroInpiAfd: null,
          totalMotoristas: 4,
        },
      ]);
      expect(resultado.usuarios).toEqual(grupoDetalhe.usuarios);
    });
  });

  describe('atualizarGrupo', () => {
    it('lança NotFoundException quando o grupo não existe', async () => {
      const { service } = criarServiceComPrismaMock({
        grupoParaAtualizar: null,
      });
      await expect(
        service.atualizarGrupo(
          'grupo-x',
          { razaoSocial: 'Novo Nome' },
          'super-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('atualiza a razão social e audita', async () => {
      const { service, auditMock } = criarServiceComPrismaMock({
        grupoParaAtualizar: { id: 'grupo-A', razaoSocial: 'Nome Antigo' },
      });
      const resultado = await service.atualizarGrupo(
        'grupo-A',
        { razaoSocial: 'Nome Novo' },
        'super-1',
      );
      expect(resultado.razaoSocial).toBe('Nome Novo');
      expect(auditMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'GRUPO_ATUALIZADO_PELO_SUPER_ADMIN',
          entidadeId: 'grupo-A',
        }),
      );
    });
  });

  describe('atualizarEmpresa', () => {
    it('lança NotFoundException quando a empresa não existe', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaParaAtualizar: null,
      });
      await expect(
        service.atualizarEmpresa('empresa-x', { razaoSocial: 'X' }, 'super-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando o novo CNPJ já pertence a outra empresa', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaParaAtualizar: {
          id: 'empresa-A',
          razaoSocial: 'Filial 1',
          cnpj: '111',
        },
        empresaComMesmoCnpj: { id: 'empresa-B' },
      });
      await expect(
        service.atualizarEmpresa('empresa-A', { cnpj: '222' }, 'super-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('atualiza os dados da empresa e audita', async () => {
      const { service, auditMock } = criarServiceComPrismaMock({
        empresaParaAtualizar: {
          id: 'empresa-A',
          razaoSocial: 'Filial 1',
          cnpj: '111',
        },
      });
      const resultado = await service.atualizarEmpresa(
        'empresa-A',
        { razaoSocial: 'Filial 1 Renomeada' },
        'super-1',
      );
      expect(resultado.razaoSocial).toBe('Filial 1 Renomeada');
      expect(auditMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'EMPRESA_ATUALIZADA_PELO_SUPER_ADMIN',
          entidadeId: 'empresa-A',
        }),
      );
    });
  });

  describe('atualizarStatusEmpresa', () => {
    it('lança NotFoundException quando a empresa não existe', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaParaAtualizar: null,
      });
      await expect(
        service.atualizarStatusEmpresa('empresa-x', false, 'super-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('desativa a empresa e audita', async () => {
      const { service, auditMock } = criarServiceComPrismaMock({
        empresaParaAtualizar: { id: 'empresa-A', ativo: true },
      });
      const resultado = await service.atualizarStatusEmpresa(
        'empresa-A',
        false,
        'super-1',
      );
      expect(resultado.ativo).toBe(false);
      expect(auditMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'EMPRESA_STATUS_ALTERADO_PELO_SUPER_ADMIN',
          entidadeId: 'empresa-A',
        }),
      );
    });
  });

  describe('atualizarUsuario', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      const { service } = criarServiceComPrismaMock({
        usuarioParaAtualizar: null,
      });
      await expect(
        service.atualizarUsuario('usuario-x', { nome: 'X' }, 'super-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando o novo e-mail já pertence a outro usuário', async () => {
      const { service } = criarServiceComPrismaMock({
        usuarioParaAtualizar: {
          id: 'usuario-A',
          nome: 'Fulano',
          email: 'fulano@a.com',
        },
        usuarioComMesmoEmail: { id: 'usuario-B' },
      });
      await expect(
        service.atualizarUsuario(
          'usuario-A',
          { email: 'outro@a.com' },
          'super-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('atualiza nome/e-mail e audita', async () => {
      const { service, auditMock } = criarServiceComPrismaMock({
        usuarioParaAtualizar: {
          id: 'usuario-A',
          nome: 'Fulano',
          email: 'fulano@a.com',
        },
      });
      const resultado = await service.atualizarUsuario(
        'usuario-A',
        { nome: 'Fulano Corrigido' },
        'super-1',
      );
      expect(resultado.nome).toBe('Fulano Corrigido');
      expect(auditMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'USUARIO_ATUALIZADO_PELO_SUPER_ADMIN',
          entidadeId: 'usuario-A',
        }),
      );
    });
  });
});
