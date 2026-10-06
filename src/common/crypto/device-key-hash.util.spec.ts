import { createHash } from 'crypto';
import {
  conferirChaveDispositivo,
  hashChaveDispositivo,
} from './device-key-hash.util';

describe('device-key-hash', () => {
  beforeAll(() => {
    process.env.DEVICE_KEY_PEPPER = 'p'.repeat(40);
  });

  it('gera HMAC v2 e confere a chave certa', () => {
    const h = hashChaveDispositivo('abc');
    expect(h.startsWith('v2:')).toBe(true);
    expect(conferirChaveDispositivo('abc', h)).toEqual({
      ok: true,
      precisaMigrar: false,
    });
  });

  it('rejeita chave errada', () => {
    const h = hashChaveDispositivo('abc');
    expect(conferirChaveDispositivo('abd', h).ok).toBe(false);
  });

  it('aceita SHA-256 antigo e sinaliza migração', () => {
    const antigo = createHash('sha256').update('abc').digest('hex');
    expect(conferirChaveDispositivo('abc', antigo)).toEqual({
      ok: true,
      precisaMigrar: true,
    });
    expect(conferirChaveDispositivo('x', antigo).precisaMigrar).toBe(false);
  });

  it('o hash novo é diferente do SHA-256 simples', () => {
    const simples = createHash('sha256').update('abc').digest('hex');
    expect(hashChaveDispositivo('abc')).not.toContain(simples);
  });
});
