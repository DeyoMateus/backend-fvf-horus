import { AejService } from './aej.service';

/**
 * Regressão: o AEJ (CSV) precisa trazer o CNPJ/razão social da empresa
 * do VÍNCULO EMPREGATÍCIO real do motorista (a Empresa específica
 * escolhida no cadastro dele), não um dado genérico do grupo , mesmo
 * critério do comprovante em PDF. Um grupo com mais de um CNPJ (ver
 * EmpresasPage.tsx) só faz sentido se cada documento gerado bater com o
 * contrato de trabalho de cada motorista.
 */
describe('AejService', () => {
  const motorista = {
    id: 'motorista-1',
    nome: 'Ana Souza',
    cpf: '11122233344',
    cnh: '99988877766',
  } as any;

  const empresa = {
    razaoSocial: 'Transportes B Ltda',
    cnpj: '11.222.333/0001-44',
  };

  const registro = {
    sequencial: 1,
    tipoEvento: 'INICIO_JORNADA',
    timestampEvento: new Date('2026-09-21T08:00:00Z'),
    latitude: null,
    longitude: null,
    observacao: null,
    hashAnterior: 'a'.repeat(64),
    hashAtual: 'b'.repeat(64),
    assinaturaDigital: null,
    deviceUuidUsado: 'device-1',
  } as any;

  it('inclui razão social e CNPJ da empresa do vínculo do motorista, não um valor genérico', () => {
    const service = new AejService();
    const csv = service.gerarCsv(motorista, empresa, [registro]);

    const linhas = csv.replace(/^﻿/, '').split('\r\n');
    const cabecalho = linhas[0].split(';');
    expect(cabecalho).toContain('empresaRazaoSocial');
    expect(cabecalho).toContain('empresaCnpj');

    const idxRazaoSocial = cabecalho.indexOf('empresaRazaoSocial');
    const idxCnpj = cabecalho.indexOf('empresaCnpj');
    const primeiraLinha = linhas[1].split(';');
    expect(primeiraLinha[idxRazaoSocial]).toBe('Transportes B Ltda');
    expect(primeiraLinha[idxCnpj]).toBe('11.222.333/0001-44');
  });
});
