"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprovanteService = void 0;
const common_1 = require("@nestjs/common");
const fuso_contexto_1 = require("../fuso/fuso-contexto");
const relatorio_pdf_1 = require("../pdf/relatorio-pdf");
let ComprovanteService = class ComprovanteService {
    async gerarPdfRegistros(motorista, empresa, registros, periodoInicio, periodoFim) {
        const r = new relatorio_pdf_1.RelatorioPdf({
            titulo: 'Comprovante de registro de jornada',
            rodape: 'Comprovante de registro de jornada',
        });
        r.cabecalho({
            titulo: 'Comprovante de registro de jornada',
            subtitulo: motorista.nome,
            campos: [
                ['Empregador', empresa.razaoSocial],
                ['CNPJ', empresa.cnpj],
                ['Motorista', motorista.nome],
                ['CPF', motorista.cpf],
                ['CNH', motorista.cnh],
                [
                    'Período',
                    `${periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`,
                ],
                ['Gerado em', (0, fuso_contexto_1.agoraDoCliente)()],
                ['Hash gênesis da cadeia', motorista.hashGenesis],
            ],
        });
        r.doc.moveDown(0.8);
        r.secao('Registros do período', `Total de registros no período: ${registros.length}`);
        if (registros.length === 0) {
            r.vazio('Nenhum registro no período.');
        }
        else {
            r.tabela([
                { titulo: '#', largura: 1.2, alinhamento: 'right' },
                { titulo: 'Evento', largura: 3 },
                { titulo: 'Data e hora', largura: 3.4 },
                { titulo: 'Hash', largura: 3.2 },
                { titulo: 'Disp.', largura: 1.6 },
            ], registros.map((registro) => [
                String(registro.sequencial),
                registro.tipoEvento + (registro.observacao ? ` (${registro.observacao})` : ''),
                (0, fuso_contexto_1.instanteDoEvento)(new Date(registro.timestampEvento), registro.fusoOffsetMin),
                `${registro.hashAtual.slice(0, 24)}…`,
                `${registro.deviceUuidUsado.slice(0, 8)}…`,
            ]), { tamanhoFonte: 7.5 });
        }
        r.doc.moveDown(0.8);
        const ultimoHash = registros.at(-1)?.hashAtual ?? motorista.hashGenesis;
        r.nota(`Este comprovante é um extrato do ledger imutável do motorista. O hash do último evento listado ` +
            `(${ultimoHash}) pode ser conferido contra a verificação de integridade da cadeia a qualquer momento , ` +
            `qualquer alteração posterior nos registros originais quebraria esse hash.`);
        return r.finalizar();
    }
};
exports.ComprovanteService = ComprovanteService;
exports.ComprovanteService = ComprovanteService = __decorate([
    (0, common_1.Injectable)()
], ComprovanteService);
//# sourceMappingURL=comprovante.service.js.map