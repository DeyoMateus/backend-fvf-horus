import { HashChainService } from './hash-chain.service';
import {
  arredondarCoordenadaGps,
  arredondarPrecisaoGps,
} from './precisao-gps.util';

/**
 * Trava contra falso positivo de integridade com GPS: simula o que o banco
 * faz com os valores (lat/lon em Decimal(10,7); precisão em double
 * devolvido com 15 dígitos significativos) e confere que o hash recalculado
 * a partir do que "volta do banco" é idêntico ao hash gravado.
 */
const noBanco = {
  coordenada: (v: number | null) => (v === null ? null : Number(v.toFixed(7))),
  precisao: (v: number | null) =>
    v === null ? null : Number(v.toPrecision(15)),
};

function aleatorio(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Hash da cadeia com GPS: ida e volta pelo banco', () => {
  const hash = new HashChainService();
  const rnd = aleatorio(42);

  const casos: Array<{ lat: number; lon: number; prec: number | null }> = [
    // caso real que quebrou: float32 do aparelho ampliado para double
    { lat: -20.98802684321, lon: -42.837637412345, prec: 25.656999588012695 },
    { lat: 0, lon: 0, prec: 0 },
    { lat: -90, lon: 180, prec: 100000 },
    { lat: 1.005, lon: -1.005, prec: 1.005 },
    { lat: -23.5505123456789, lon: -46.6333094, prec: null },
  ];
  for (let i = 0; i < 2000; i++) {
    casos.push({
      lat: (rnd() - 0.5) * 180 + rnd() * 1e-9,
      lon: (rnd() - 0.5) * 360 + rnd() * 1e-9,
      // metade vem como float32 ampliado (como o app envia), metade com
      // muitas casas
      prec:
        i % 2 === 0 ? Math.fround(rnd() * 500) : rnd() * 500 + rnd() * 1e-12,
    });
  }

  it.each([0, 1, 2, 3, 4])('caso fixo %i confere', (i) => {
    expect(conferir(casos[i])).toBe(true);
  });

  it('2000 combinações aleatórias de GPS sempre conferem após ida e volta pelo banco', () => {
    const falhas = casos.filter((c) => !conferir(c));
    expect(falhas).toEqual([]);
  });

  function conferir(c: { lat: number; lon: number; prec: number | null }) {
    const lat = arredondarCoordenadaGps(c.lat);
    const lon = arredondarCoordenadaGps(c.lon);
    const prec = arredondarPrecisaoGps(c.prec);
    const base = {
      motoristaId: 'm1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-10-07T11:37:56.486Z'),
      deviceUuidUsado: 'd1',
      observacao: null,
      odometro: null,
      sequencial: 1,
      fusoOffsetMin: -180,
    };
    // gravação: hash com o valor normalizado
    const hashAtual = hash.calcularHash('GEN', 1, {
      ...base,
      latitude: lat,
      longitude: lon,
      precisaoGpsM: prec,
    });
    // verificação: valores lidos de volta do "banco"
    const r = hash.verificarCadeia('GEN', [
      {
        ...base,
        hashAnterior: 'GEN',
        hashAtual,
        latitude: noBanco.coordenada(lat),
        longitude: noBanco.coordenada(lon),
        precisaoGpsM: noBanco.precisao(prec),
      },
    ]);
    return r.valido;
  }

  it('sem a normalização o caso real do bug de fato quebraria (a trava é efetiva)', () => {
    const base = {
      motoristaId: 'm1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-10-07T11:37:56.486Z'),
      deviceUuidUsado: 'd1',
      observacao: null,
      odometro: null,
      sequencial: 1,
    };
    const cru = 25.656999588012695;
    const hashAtual = hash.calcularHash('GEN', 1, {
      ...base,
      latitude: -20.9880268,
      longitude: -42.8376374,
      precisaoGpsM: cru,
    });
    const r = hash.verificarCadeia('GEN', [
      {
        ...base,
        hashAnterior: 'GEN',
        hashAtual,
        latitude: -20.9880268,
        longitude: -42.8376374,
        precisaoGpsM: noBanco.precisao(cru),
      },
    ]);
    expect(r.valido).toBe(false);
  });
});
