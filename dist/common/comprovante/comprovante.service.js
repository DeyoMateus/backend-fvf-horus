"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprovanteService = void 0;
const common_1 = require("@nestjs/common");
const pdfkit_1 = __importDefault(require("pdfkit"));
let ComprovanteService = class ComprovanteService {
    async gerarPdfRegistros(motorista, empresa, registros, periodoInicio, periodoFim) {
        const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        const finalizado = new Promise((resolve) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
        });
        doc
            .fontSize(16)
            .text('FVF Hórus , Comprovante de registro de jornada', {
            align: 'center',
        });
        doc.moveDown();
        doc.fontSize(10).fillColor('#374151');
        doc.font('Helvetica-Bold').text(`Empregador: ${empresa.razaoSocial}`);
        doc.font('Helvetica').text(`CNPJ: ${empresa.cnpj}`);
        doc.moveDown(0.5);
        doc.text(`Motorista: ${motorista.nome}`);
        doc.text(`CPF: ${motorista.cpf}   CNH: ${motorista.cnh}`);
        doc.text(`Período: ${periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
        doc.text(`Hash gênesis da cadeia: ${motorista.hashGenesis}`);
        doc.moveDown();
        doc.fontSize(9).fillColor('#111827');
        doc.text(`Total de registros no período: ${registros.length}`, {
            underline: registros.length === 0,
        });
        doc.moveDown(0.5);
        for (const registro of registros) {
            doc
                .fontSize(9)
                .fillColor('#111827')
                .text(`#${registro.sequencial}  ${registro.tipoEvento}  ,  ${new Date(registro.timestampEvento).toLocaleString('pt-BR')}` +
                (registro.observacao ? `  (${registro.observacao})` : ''));
            doc
                .fontSize(7)
                .fillColor('#6b7280')
                .text(`   hash: ${registro.hashAtual.slice(0, 24)}…  dispositivo: ${registro.deviceUuidUsado.slice(0, 8)}…`);
        }
        doc.moveDown();
        const ultimoHash = registros.at(-1)?.hashAtual ?? motorista.hashGenesis;
        doc
            .fontSize(8)
            .fillColor('#6b7280')
            .text(`Este comprovante é um extrato do ledger imutável do motorista. O hash do último evento listado ` +
            `(${ultimoHash}) pode ser conferido contra a verificação de integridade da cadeia a qualquer momento , ` +
            `qualquer alteração posterior nos registros originais quebraria esse hash.`, { align: 'justify' });
        doc.end();
        return finalizado;
    }
};
exports.ComprovanteService = ComprovanteService;
exports.ComprovanteService = ComprovanteService = __decorate([
    (0, common_1.Injectable)()
], ComprovanteService);
//# sourceMappingURL=comprovante.service.js.map