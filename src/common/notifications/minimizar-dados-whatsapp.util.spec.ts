import { mascararDadosPessoais, nomeAbreviado } from './minimizar-dados-whatsapp.util';

describe('minimizar-dados-whatsapp', () => {
  it('abrevia o nome', () => {
    expect(nomeAbreviado('João da Silva Souza')).toBe('João S.');
    expect(nomeAbreviado('Maria')).toBe('Maria');
    expect(nomeAbreviado('  ')).toBe('Motorista');
    expect(nomeAbreviado(null)).toBe('Motorista');
  });

  it('mascara CPF, e-mail, telefone e coordenadas', () => {
    const t = mascararDadosPessoais(
      'CPF 123.456.789-09 ou 12345678909, joao@x.com, fone (11) 99999-8888 e -23.550520, -46.633308',
    );
    expect(t).not.toMatch(/123\.456|12345678909|joao@|99999|23\.55/);
    expect(t).toContain('[CPF omitido]');
    expect(t).toContain('[e-mail omitido]');
    expect(t).toContain('[telefone omitido]');
    expect(t).toContain('[localização omitida]');
  });

  it('não mexe em horários e durações', () => {
    const t = 'Direção contínua de 05:30 às 07:00, limite 08:00, faltam 02:15.';
    expect(mascararDadosPessoais(t)).toBe(t);
  });
});
