import type { Config } from 'jest';
import { createJsWithTsEsmPreset, pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

// NestJS 12 é publicado como ESM puro (@nestjs/*/package.json tem
// "type": "module"). `createJsWithTsEsmPreset` faz o Jest rodar em modo
// ESM de verdade (não CommonJS) e transforma tanto nosso .ts quanto os
// .js do próprio node_modules , sem isso, qualquer import de @nestjs/*
// nos testes falha com "Must use import to load ES Module".
const preset = createJsWithTsEsmPreset({
  tsconfig: {
    // Força saída ESM real pro transform do Jest, mesmo com
    // "module": "nodenext" no tsconfig do projeto (que, sem
    // "type": "module" no package.json, geraria CommonJS , e o
    // loader ESM do Node usado pelo Jest não entende `exports.foo=`).
    module: 'ESNext',
    moduleResolution: 'bundler',
  },
});

const config: Config = {
  ...preset,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),

  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
