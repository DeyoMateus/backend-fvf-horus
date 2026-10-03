import { jest as jestReal } from '@jest/globals';
type FuncaoQualquer = (...args: any[]) => any;
type JestPermissivo = Omit<typeof jestReal, 'fn'> & {
    fn<T extends FuncaoQualquer = FuncaoQualquer>(implementation?: T): jest.Mock<ReturnType<T>, Parameters<T>> & T;
};
export declare const jest: JestPermissivo;
export {};
