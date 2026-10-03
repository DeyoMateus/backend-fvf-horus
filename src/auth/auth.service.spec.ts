import { jest } from '@test/jest-globals';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  function criarServiceComMocks(usuario: any) {
    const prismaMock = {
      usuarioEmpresa: {
        findUnique: jest.fn().mockResolvedValue(usuario),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops as any)),
    } as any;
    const jwtMock = { signAsync: jest.fn().mockResolvedValue('token-fake') } as any;
    const configMock = { get: jest.fn((_key: string, def?: string) => def) } as any;
    const auditMock = { registrar: jest.fn().mockResolvedValue(undefined) } as any;
    const emailMock = { configurado: jest.fn().mockReturnValue(false), enviar: jest.fn().mockResolvedValue(undefined) } as any;
    const lockoutMock = {
      segundosBloqueados: jest.fn().mockResolvedValue(0),
      registrarFalha: jest.fn().mockResolvedValue(undefined),
      registrarSucesso: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new AuthService(prismaMock, jwtMock, configMock, auditMock, emailMock, lockoutMock);
    return { service, prismaMock, auditMock, emailMock, lockoutMock };
  }

  it('login: credenciais corretas emitem tokens e registram sucesso no audit log', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, auditMock } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      grupoId: 'g1',
      papel: 'GESTOR',
      ativo: true,
      senhaHash,
    });

    const tokens = await service.login('gestor@empresa.com', 'senha-correta');
    expect(tokens.accessToken).toBe('token-fake');
    expect(tokens.refreshToken).toHaveLength(96); // 48 bytes em hex
    expect(auditMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'LOGIN_SUCESSO' }));
  });

  it('login: senha errada lança erro genérico (não revela se o usuário existe)', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, auditMock } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      grupoId: 'g1',
      papel: 'GESTOR',
      ativo: true,
      senhaHash,
    });

    await expect(service.login('gestor@empresa.com', 'senha-errada')).rejects.toThrow(UnauthorizedException);
    await expect(service.login('gestor@empresa.com', 'senha-errada')).rejects.toThrow('Credenciais inválidas');
    expect(auditMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'LOGIN_FALHOU' }));
  });

  it('login: e-mail inexistente lança a MESMA mensagem genérica (não diferencia de senha errada)', async () => {
    const { service } = criarServiceComMocks(null);
    await expect(service.login('naoexiste@empresa.com', 'qualquer-coisa')).rejects.toThrow('Credenciais inválidas');
  });

  it('login: usuário inativo é bloqueado mesmo com senha correta', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      grupoId: 'g1',
      papel: 'GESTOR',
      ativo: false,
      senhaHash,
    });
    await expect(service.login('gestor@empresa.com', 'senha-correta')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh: token expirado é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      usuario: { ativo: true },
    });
    await expect(service.refresh('token-plano-qualquer')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh: token já revogado é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
      usuario: { ativo: true },
    });
    await expect(service.refresh('token-plano-qualquer')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh: token válido é rotacionado (o antigo é revogado ao emitir um novo)', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      usuario: { id: 'u1', email: 'g@e.com', grupoId: 'g1', papel: 'GESTOR', ativo: true },
    });

    await service.refresh('token-plano-qualquer');
    expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('login: conta bloqueada por excesso de tentativas rejeita mesmo com senha correta', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, lockoutMock } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      grupoId: 'g1',
      papel: 'GESTOR',
      ativo: true,
      senhaHash,
    });
    lockoutMock.segundosBloqueados.mockResolvedValue(300);

    await expect(service.login('gestor@empresa.com', 'senha-correta')).rejects.toThrow('Muitas tentativas de login');
  });

  it('login: senha errada registra falha no AccountLockoutService', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, lockoutMock } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      grupoId: 'g1',
      papel: 'GESTOR',
      ativo: true,
      senhaHash,
    });

    await expect(service.login('gestor@empresa.com', 'senha-errada')).rejects.toThrow(UnauthorizedException);
    expect(lockoutMock.registrarFalha).toHaveBeenCalledWith('usuario-empresa', 'gestor@empresa.com');
  });

  it('login: sucesso zera o contador de falhas no AccountLockoutService', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 4);
    const { service, lockoutMock } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      grupoId: 'g1',
      papel: 'GESTOR',
      ativo: true,
      senhaHash,
    });

    await service.login('gestor@empresa.com', 'senha-correta');
    expect(lockoutMock.registrarSucesso).toHaveBeenCalledWith('usuario-empresa', 'gestor@empresa.com');
  });

  it('esqueciSenha: usuário existente e ativo gera token, envia e-mail e audita', async () => {
    const { service, prismaMock, auditMock, emailMock } = criarServiceComMocks({
      id: 'u1',
      email: 'gestor@empresa.com',
      ativo: true,
    });

    await service.esqueciSenha('gestor@empresa.com');

    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'u1' }) }),
    );
    expect(emailMock.enviar).toHaveBeenCalledWith('gestor@empresa.com', expect.any(String), expect.any(String));
    expect(auditMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'RECUPERACAO_SENHA_SOLICITADA' }));
  });

  it('esqueciSenha: e-mail inexistente não cria token nem envia e-mail (resposta silenciosa)', async () => {
    const { service, prismaMock, emailMock } = criarServiceComMocks(null);
    await service.esqueciSenha('naoexiste@empresa.com');
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailMock.enviar).not.toHaveBeenCalled();
  });

  it('esqueciSenha: usuário inativo não cria token nem envia e-mail', async () => {
    const { service, prismaMock, emailMock } = criarServiceComMocks({ id: 'u1', email: 'g@e.com', ativo: false });
    await service.esqueciSenha('g@e.com');
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailMock.enviar).not.toHaveBeenCalled();
  });

  it('redefinirSenha: token válido troca a senha, marca o token como usado e revoga refresh tokens', async () => {
    const { service, prismaMock, auditMock } = criarServiceComMocks(null);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt1',
      usuarioId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      usuario: { ativo: true },
    });

    await service.redefinirSenha('token-plano', 'nova-senha-123');

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(auditMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'SENHA_REDEFINIDA' }));
  });

  it('redefinirSenha: token expirado é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt1',
      usuarioId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      usuario: { ativo: true },
    });
    await expect(service.redefinirSenha('token-plano', 'nova-senha-123')).rejects.toThrow(UnauthorizedException);
  });

  it('redefinirSenha: token já usado é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt1',
      usuarioId: 'u1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
      usuario: { ativo: true },
    });
    await expect(service.redefinirSenha('token-plano', 'nova-senha-123')).rejects.toThrow(UnauthorizedException);
  });

  it('redefinirSenha: token inexistente é rejeitado', async () => {
    const { service, prismaMock } = criarServiceComMocks(null);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(service.redefinirSenha('token-plano', 'nova-senha-123')).rejects.toThrow(UnauthorizedException);
  });
});
