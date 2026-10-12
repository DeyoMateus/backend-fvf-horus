export interface ResultadoVerificacaoProducao {
    erros: string[];
    avisos: string[];
}
export declare function verificarConfiguracaoDeProducao(env: NodeJS.ProcessEnv): ResultadoVerificacaoProducao;
