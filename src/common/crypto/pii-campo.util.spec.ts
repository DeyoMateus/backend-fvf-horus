import {
  cifrarArgumentosPii,
  cifrarCampo,
  condicaoBuscaCpf,
  decifrarCampo,
  estaCifrado,
  reiniciarChavesPii,
  revelarPii,
} from './pii-campo.util';

describe('criptografia de campos pessoais (CPF/CNH/telefone)', () => {
  const antes = { ...process.env };
  beforeEach(() => {
    process.env.CRYPTO_MASTER_KEY = 'a'.repeat(64);
    process.env.PII_ENCRYPTION_ENABLED = 'true';
    reiniciarChavesPii();
  });
  afterAll(() => {
    process.env = antes;
    reiniciarChavesPii();
  });

  it('cifra e decifra, e o texto cifrado não contém o valor', () => {
    const c = cifrarCampo('cpf', '12345678909');
    expect(estaCifrado(c)).toBe(true);
    expect(c).not.toContain('12345678909');
    expect(decifrarCampo('cpf', c)).toBe('12345678909');
  });

  it('é determinístico (mesmo valor, mesmo cifrado) e idempotente', () => {
    expect(cifrarCampo('cpf', '12345678909')).toBe(
      cifrarCampo('cpf', '12345678909'),
    );
    const c = cifrarCampo('cnh', '98765432100');
    expect(cifrarCampo('cnh', c)).toBe(c);
  });

  it('campos diferentes geram cifrados diferentes e não se misturam', () => {
    const cpf = cifrarCampo('cpf', '12345678909');
    const cnh = cifrarCampo('cnh', '12345678909');
    expect(cpf).not.toBe(cnh);
    expect(() => decifrarCampo('cnh', cpf)).toThrow();
  });

  it('texto puro (dado antigo) passa direto na leitura', () => {
    expect(decifrarCampo('cpf', '12345678909')).toBe('12345678909');
  });

  it('revela campos cifrados em qualquer nível, inclusive include aninhado', () => {
    const resultado = {
      id: 'r1',
      motorista: {
        nome: 'Fulano',
        cpf: cifrarCampo('cpf', '12345678909'),
        telefone: cifrarCampo('telefone', '+5511999990000'),
      },
      lista: [{ cnh: cifrarCampo('cnh', '98765432100') }],
    };
    revelarPii(resultado);
    expect(resultado.motorista.cpf).toBe('12345678909');
    expect(resultado.motorista.telefone).toBe('+5511999990000');
    expect(resultado.lista[0].cnh).toBe('98765432100');
  });

  it('cifra where (igualdade, in, OR) e data (inclusive set); só com a flag ligada', () => {
    const [a] = cifrarArgumentosPii('findFirst', [
      { where: { OR: [{ cpf: '1' }, { cnh: { in: ['2', '3'] } }], nome: 'x' } },
    ]) as any[];
    expect(estaCifrado(a.where.OR[0].cpf)).toBe(true);
    expect(a.where.OR[1].cnh.in.every(estaCifrado)).toBe(true);
    expect(a.where.nome).toBe('x');

    const [b] = cifrarArgumentosPii('update', [
      { where: { id: 'i' }, data: { telefone: { set: '+55' }, nome: 'y' } },
    ]) as any[];
    expect(estaCifrado(b.data.telefone.set)).toBe(true);
    expect(b.where.id).toBe('i');

    process.env.PII_ENCRYPTION_ENABLED = 'false';
    const [c] = cifrarArgumentosPii('findFirst', [
      { where: { cpf: '1' } },
    ]) as any[];
    expect(c.where.cpf).toBe('1');
  });

  it('busca por CPF: completo com a cifra ligada, parcial com ela desligada', () => {
    expect(condicaoBuscaCpf('123.456.789-09')).toEqual({ cpf: '12345678909' });
    expect(condicaoBuscaCpf('1234')).toBeNull();
    process.env.PII_ENCRYPTION_ENABLED = 'false';
    expect(condicaoBuscaCpf('1234')).toEqual({ cpf: { contains: '1234' } });
  });
});
