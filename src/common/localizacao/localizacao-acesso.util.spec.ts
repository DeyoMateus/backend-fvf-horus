import {
  podeVerLocalizacao,
  removerCoordenadas,
} from './localizacao-acesso.util';

describe('localizacao-acesso.util', () => {
  it('ADMIN e GESTOR (usuários do painel) veem localização; outros não', () => {
    expect(podeVerLocalizacao('ADMIN')).toBe(true);
    expect(podeVerLocalizacao('GESTOR')).toBe(true);
    expect(podeVerLocalizacao('MOTORISTA')).toBe(false);
    expect(podeVerLocalizacao(undefined)).toBe(false);
    expect(podeVerLocalizacao('admin')).toBe(false);
  });

  it('zera latitude/longitude em qualquer nível sem mexer no original', () => {
    const data = new Date('2026-01-01T00:00:00Z');
    const original = {
      id: 'a',
      latitude: -23.5,
      longitude: -46.6,
      quando: data,
      itens: [{ latitude: 1, longitude: 2, tipo: 'X' }],
      aninhado: { evento: { latitude: '9.1', longitude: '9.2' } },
    };
    const saida = removerCoordenadas(original);
    expect(saida.latitude).toBeNull();
    expect(saida.longitude).toBeNull();
    expect(saida.itens[0]).toEqual({ latitude: null, longitude: null, tipo: 'X' });
    expect(saida.aninhado.evento).toEqual({ latitude: null, longitude: null });
    expect(saida.quando).toBe(data);
    expect(saida.id).toBe('a');
    expect(original.latitude).toBe(-23.5);
    expect(original.itens[0].latitude).toBe(1);
  });

  it('mantém valores que não são objetos simples (Date, null, primitivos)', () => {
    expect(removerCoordenadas(null)).toBeNull();
    expect(removerCoordenadas('x')).toBe('x');
    expect(removerCoordenadas(5)).toBe(5);
  });
});
