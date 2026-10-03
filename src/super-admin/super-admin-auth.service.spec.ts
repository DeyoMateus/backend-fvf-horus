import { jest } from '@test/jest-globals';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SuperAdminAuthService } from './super-admin-auth.service';

/**
 * Espelha `auth.service.spec.ts` (UsuarioEmpresa) , mesmos casos,
 * mesma estrutura de mocks posicionais, agora para o super admin da
 * plataforma. Cobre principalmente os métodos novos desta rodada
 * (esqueciSenha/redefinirSenha), já que login/refresh/logout seguem
 * exatamente o mesmo desenho testado do lado de UsuarioEmpresa.
 */
describe('SuperAdminAuthService', () => {
  function criarServiceComMocks(superAdmin: any) {
    const prismaMock = {
      superAdminUsuario: {
        findUnique: jest.fn().mockResolvedValue(superAdmin),
        update: jest.fn().mockResolvedValue({}),
      },
      superAdminRefreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      superAdminPasswordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (ops: unknown[]) => Promise.all(ops as any)),
    } as any;
    const jwtMock = {
      signAsync: jest.fn().mockResolvedValue('token-fake'),
    } as any;
    const configMock = {
      get: jest.fn((_key: string, def?: string) => def),
    } as any;
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const emailMock = {
      configurado: jest.fn().mockReturnValue(false),
      enviar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const lockoutMock = {
      segundosBloqueados: jest.fn().mockResolvedValue(0),
      registrarFalha: jest.fn().mockResolvedValue(undefined),
      registrarSucesso: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new SuperAdminAuthService(
      prismaMock,
      jwtMock,
      configMock,
      auditMock,
      emailMock,
      lockoutMock,
    );
    return { service, prismaMock, auditMock, emailMock, lockoutMock };
  }

  it('login: credenciais corretas emitem tokens e registram sucesso no audit log', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, auditMock } = criarServiceComMocks({
      id: 'sa1',
      email: 'super@fvfhorus.local',
      ativo: true,
      senhaHash,
    });

    const tokens = await service.login('super@fvfhorus.local', 'senha-correta');
    expect(tokens.accessToken).toBe('token-fake');
    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'SUPER_ADMIN_LOGIN_SUCESSO' }),
    );
  });

  it('login: e-mail inexistente lança erro genérico', async () => {
    const { service } = criarServiceComMocks(null);
    await expect(
      service.login('naoexiste@fvfhorus.local', 'qualquer-coisa'),
    ).rejects.toThrow('Credenciais inválidas');
  });

  it('login: conta bloqueada por excesso de tentativas rejeita mesmo com senha correta', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, lockoutMock } = criarServiceComMocks({
      id: 'sa1',
      email: 'super@fvfhorus.local',
      ativo: true,
      senhaHash,
    });
    lockoutMock.segundosBloqueados.mockResolvedValue(300);

    await expect(
      service.login('super@fvfhorus.local', 'senha-correta'),
    ).rejects.toThrow('Muitas tentativas de login');
  });

  it('login: senha errada registra falha no AccountLockoutService', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, lockoutMock } = criarServiceComMocks({
      id: 'sa1',
      email: 'super@fvfhorus.local',
      ativo: true,
      senhaHash,
    });

    await expect(
      service.login('super@fvfhorus.local', 'senha-errada'),
    ).rejects.toThrow(UnauthorizedException);
    expect(lockoutMock.registrarFalha).toHaveBeenCalledWith(
      'super-admin',
      'super@fvfhorus.local',
    );
  });

  it('esqueciSenha: super admin existente e ativo gera token, envia e-mail e audita', async () => {
    const { service, prismaMock, auditMock, emailMock } = criarServiceComMocks({
      id: 'sa1',
      email: 'super@fvfhorus.local',
      ativo: true,
    });

    await service.esqueciSenha('super@fvfhorus.local');

    expect(prismaMock.superAdminPasswordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ superAdminId: 'sa1' }),
      }),
    );
    expect(emailMock.enviar).toHaveBeenCalledWith(
      'super@fvfhorus.local',
      expect.any(String),
      expect.any(String),
    );
    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'SUPER_ADMIN_RECUPERACAO_SENHA_SOLICITADA',
      }),
    );
  });

  it('esqueciSenha: e-mail inexistente não cria token nem envia e-mail', async () => {
    const { service, prismaMock, emailMock } = criarServiceComMocks(null);
    await service.esqueciSenha('naoexiste@fvfhorus.local');
    expect(
      prismaMock.superAdminPasswordResetToken.create,
    ).not.toHaveBeenCalled();
    expect(emailMock.enviar).not.toHaveBeenCalled();
  });

  it('redefinirSenha: token válido troca a senha, marca o token como usado e revoga refresh tokens', async () => {
    const { service, prismaMock, auditMock } = criarServiceComMocks(null);
    prismaMock.superAdminPasswordResetToken.findUnique.mockResolvedValue({
      id: 'sprt1',
      superAdminId: 'sa1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      superAdmin: { ativo: true },
    });

    await service.redefinirSenha('token-plano', 'nova-senha-123');

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'SUPER_ADMIN_SENHA_REDEFINIDA' }),
    );
  });

  it('redefinirSenha: token expirado é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.superAdminPasswordResetToken.findUnique.mockResolvedValue({
      id: 'sprt1',
      superAdminId: 'sa1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      superAdmin: { ativo: true },
    });
    await expect(
      service.redefinirSenha('token-plano', 'nova-senha-123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('redefinirSenha: token inexistente é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.superAdminPasswordResetToken.findUnique.mockResolvedValue(null);
    await expect(
      service.redefinirSenha('token-plano', 'nova-senha-123'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
