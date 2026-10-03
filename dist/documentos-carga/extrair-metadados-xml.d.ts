export interface MetadadosExtraidosXml {
    numero?: string;
    chaveAcesso?: string;
    enderecoDestinatario?: string;
}
export declare function extrairMetadadosXml(xmlTexto: string): MetadadosExtraidosXml;
