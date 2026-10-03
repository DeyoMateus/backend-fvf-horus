"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FechamentoFiscalService = void 0;
const common_1 = require("@nestjs/common");
const pdfkit_1 = __importDefault(require("pdfkit"));
const pdf_lib_1 = require("pdf-lib");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const registros_jornada_service_1 = require("../registros-jornada/registros-jornada.service");
const rep_p_service_1 = require("../common/rep-p/rep-p.service");
const feriados_service_1 = require("../feriados/feriados.service");
const INCLUDE_EMPRESA_COM_REGRA_SINDICAL = {
    empresa: {
        select: {
            razaoSocial: true,
            cnpj: true,
            regraSindical: true,
            grupoId: true,
        },
    },
    dispositivoVinculado: { select: { deviceUuid: true } },
};
let FechamentoFiscalService = class FechamentoFiscalService {
    prisma;
    registrosJornada;
    repP;
    feriados;
    constructor(prisma, registrosJornada, repP, feriados) {
        this.prisma = prisma;
        this.registrosJornada = registrosJornada;
        this.repP = repP;
        this.feriados = feriados;
    }
    async gerarEspelhosRepPEmLote(grupoId, dataInicio, dataFim, motoristaIds) {
        const motoristas = await this.prisma.motorista.findMany({
            where: {
                empresa: { grupoId },
                excluidoEm: null,
                ...(motoristaIds && motoristaIds.length > 0
                    ? { id: { in: motoristaIds } }
                    : { status: client_1.StatusMotorista.ATIVO }),
            },
            include: INCLUDE_EMPRESA_COM_REGRA_SINDICAL,
            orderBy: { nome: 'asc' },
        });
        if (motoristaIds && motoristaIds.length > 0) {
            const idsEncontrados = new Set(motoristas.map((m) => m.id));
            const idsForaDoGrupo = motoristaIds.filter((id) => !idsEncontrados.has(id));
            if (idsForaDoGrupo.length > 0) {
                throw new common_1.ForbiddenException(`Motorista(s) fora do seu grupo: ${idsForaDoGrupo.join(', ')}`);
            }
        }
        const periodoInicio = new Date(0);
        const buffers = [
            await this.gerarCapa(motoristas.map((m) => m.nome), dataInicio, dataFim),
        ];
        for (const motorista of motoristas) {
            const [registros, tratamentos, feriadosRaw] = await Promise.all([
                this.registrosJornada.listByMotoristaNoPeriodo(motorista.id, dataInicio, dataFim),
                this.prisma.tratamentoPonto.findMany({
                    where: {
                        motoristaId: motorista.id,
                        timestampEvento: { gte: dataInicio, lte: dataFim },
                    },
                    orderBy: { timestampEvento: 'asc' },
                    include: { usuario: { select: { nome: true } } },
                }),
                this.feriados.listarParaRelatorio(motorista.empresa.grupoId, motorista.empresaId, dataInicio, dataFim),
            ]);
            const feriadosNoPeriodo = feriadosRaw.map((f) => ({
                data: f.data.toISOString().slice(0, 10),
                descricao: f.descricao,
                pagoComoDomingo: f.pagoComoDomingo,
            }));
            const pdf = await this.repP.gerarPdf(motorista, motorista.empresa, motorista.empresa.regraSindical, registros, tratamentos, feriadosNoPeriodo, { periodoInicio: dataInicio ?? periodoInicio, periodoFim: dataFim }, motorista.dispositivoVinculado?.deviceUuid ?? null);
            buffers.push(pdf);
        }
        return this.mesclarPdfs(buffers);
    }
    async gerarCapa(nomesMotoristas, dataInicio, dataFim) {
        const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        const finalizado = new Promise((resolve) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
        });
        doc
            .fontSize(16)
            .text('FVF Hórus , Espelhos de Ponto Eletrônico (REP-P) para fiscalização', { align: 'center' });
        doc.moveDown(0.2);
        doc
            .fontSize(9)
            .fillColor('#374151')
            .text(`Período: ${dataInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${dataFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}   |   ` +
            `${nomesMotoristas.length} motorista(s)   |   Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
        doc.moveDown();
        doc
            .fontSize(8)
            .fillColor('#6b7280')
            .text('Cada espelho a seguir é assinado digitalmente com o certificado do próprio motorista (RSA-SHA256, CA ' +
            'interna do FVF Hórus , não é uma assinatura ICP-Brasil A1/PKCS#7 válida; ver claude/bloqueios-dependentes-do-usuario.md ' +
            'sobre o certificado ICP-Brasil e2CNPJ pendente) e traz a cadeia de hash do período, com status de ' +
            'integridade. Para o arquivo AFD oficial (Portaria 671/2021, leiaute binário fixo), use a exportação ' +
            'separada em Empresas.', { align: 'left' });
        doc.moveDown();
        doc
            .fontSize(10)
            .fillColor('#111827')
            .font('Helvetica-Bold')
            .text('Motoristas incluídos:');
        doc.font('Helvetica').fontSize(9);
        if (nomesMotoristas.length === 0) {
            doc
                .fillColor('#6b7280')
                .text('Nenhum motorista encontrado para este filtro.');
        }
        for (const nome of nomesMotoristas) {
            doc.text(`• ${nome}`);
        }
        doc.end();
        return finalizado;
    }
    async mesclarPdfs(buffers) {
        const combinado = await pdf_lib_1.PDFDocument.create();
        for (const buffer of buffers) {
            const origem = await pdf_lib_1.PDFDocument.load(buffer);
            const paginas = await combinado.copyPages(origem, origem.getPageIndices());
            for (const pagina of paginas)
                combinado.addPage(pagina);
        }
        const bytes = await combinado.save();
        return Buffer.from(bytes);
    }
};
exports.FechamentoFiscalService = FechamentoFiscalService;
exports.FechamentoFiscalService = FechamentoFiscalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        registros_jornada_service_1.RegistrosJornadaService,
        rep_p_service_1.RepPService,
        feriados_service_1.FeriadosService])
], FechamentoFiscalService);
//# sourceMappingURL=fechamento-fiscal.service.js.map