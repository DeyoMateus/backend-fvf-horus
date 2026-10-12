import { jest } from '@test/jest-globals';
import { MonitoramentoOperacionalService } from './monitoramento-operacional.service';

function criar() {
  const email = { enviar: jest.fn().mockResolvedValue(undefined) };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new MonitoramentoOperacionalService(
    {} as never,
    {} as never,
    email as never,
    audit as never,
  );
  return { svc, email, audit };
}

describe('MonitoramentoOperacionalService.processarTransicoes', () => {
  beforeEach(() => {
    process.env.ALERTA_OPERACIONAL_EMAIL = 'ops@exemplo.com';
    delete process.env.ALERTA_WEBHOOK_URL;
  });

  it('avisa uma vez no problema e uma vez na recuperação', async () => {
    const { svc, email } = criar();
    const falha = [{ chave: 'redis', ok: false, detalhe: 'Redis fora' }];
    await svc.processarTransicoes(falha);
    await svc.processarTransicoes(falha); // continua em problema: não repete
    expect(email.enviar).toHaveBeenCalledTimes(1);
    expect(email.enviar.mock.calls[0][1]).toContain('PROBLEMA');

    await svc.processarTransicoes([{ chave: 'redis', ok: true, detalhe: 'ok' }]);
    expect(email.enviar).toHaveBeenCalledTimes(2);
    expect(email.enviar.mock.calls[1][1]).toContain('RESOLVIDO');

    await svc.processarTransicoes([{ chave: 'redis', ok: true, detalhe: 'ok' }]);
    expect(email.enviar).toHaveBeenCalledTimes(2);
  });

  it('não avisa nada quando tudo está ok', async () => {
    const { svc, email } = criar();
    await svc.processarTransicoes([{ chave: 'banco', ok: true, detalhe: 'ok' }]);
    expect(email.enviar).not.toHaveBeenCalled();
  });
});
