export declare const VERSAO_DOCUMENTOS = "2026-10-11";
export declare const PRAZO_RESPOSTA_TITULAR_DIAS = 15;
export interface DadosControlador {
    razaoSocial: string;
    cnpj: string;
    encarregadoNome: string | null;
    encarregadoEmail: string | null;
    encarregadoTelefone: string | null;
}
export declare function montarDocumentos(c: DadosControlador | null): {
    versao: string;
    controlador: {
        razaoSocial: string;
        cnpj: string;
    } | null;
    encarregado: {
        nome: string;
        email: string | null;
        telefone: string | null;
    } | null;
    documentos: {
        tipo: string;
        titulo: string;
        texto: string;
    }[];
};
