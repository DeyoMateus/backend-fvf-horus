/**
 * Rodada 74 , wrapper em torno de `jest` (de `@jest/globals`) usado por todos
 * os arquivos `.spec.ts` do backend, em vez de importar `@jest/globals`
 * diretamente.
 *
 * Contexto: este projeto roda o Jest em modo ESM real (ver `jest.config.ts`,
 * `createJsWithTsEsmPreset`) , nesse modo o Jest não injeta `jest` como
 * global ambiente (só `describe`/`it`/`expect` continuam ambiente), então
 * cada spec precisa importar `jest` explicitamente para não quebrar em
 * runtime com `ReferenceError: jest is not defined`.
 *
 * O problema é que o `jest` exportado por `@jest/globals` (Jest 30) tipa
 * `jest.fn()` com o genérico `UnknownFunction = (...args: unknown[]) => unknown`
 * por padrão (em vez do antigo `Mock<T = any, Y = any, C = any>` do
 * `@types/jest` 29.x) , isso faz `jest.fn().mockResolvedValue(x)` e afins
 * inferirem parâmetro `never` em dezenas de specs (158 erros de `tsc -b`).
 *
 * Em vez de reescrever cada `jest.fn()` do projeto com genéricos explícitos,
 * este arquivo reexporta o MESMO objeto `jest` em runtime (então o
 * comportamento não muda nem um pouco), só que com uma assinatura de `fn`
 * mais permissiva para o TypeScript , igual ao comportamento antigo do
 * `@types/jest` 29.x que o projeto já usava antes do Jest 30.
 */
import { jest as jestReal } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FuncaoQualquer = (...args: any[]) => any;

type JestPermissivo = Omit<typeof jestReal, 'fn'> & {
  fn<T extends FuncaoQualquer = FuncaoQualquer>(
    implementation?: T,
  ): jest.Mock<ReturnType<T>, Parameters<T>> & T;
};

export const jest: JestPermissivo = jestReal as unknown as JestPermissivo;
