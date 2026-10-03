import type { ItemDossieCobranca } from './dossie-cobranca.service';
export declare function gerarPdfDossieCobranca(itens: ItemDossieCobranca[], empresaNome: string, periodoInicio: Date, periodoFim: Date): Promise<Buffer>;
