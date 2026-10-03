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
var LoteRegistrosJornadaProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoteRegistrosJornadaProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const tenant_context_1 = require("../common/tenant/tenant-context");
const prisma_service_1 = require("../common/prisma/prisma.service");
const lote_registros_jornada_constants_1 = require("./lote-registros-jornada.constants");
const registros_jornada_service_1 = require("./registros-jornada.service");
let LoteRegistrosJornadaProcessor = LoteRegistrosJornadaProcessor_1 = class LoteRegistrosJornadaProcessor extends bullmq_1.WorkerHost {
    registrosJornada;
    prisma;
    logger = new common_1.Logger(LoteRegistrosJornadaProcessor_1.name);
    constructor(registrosJornada, prisma) {
        super();
        this.registrosJornada = registrosJornada;
        this.prisma = prisma;
    }
    async process(job) {
        const { motoristaId, deviceUuid, eventos, ip, userAgent } = job.data;
        const motorista = await tenant_context_1.TenantContext.paraSistema(() => this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: { empresa: { select: { grupoId: true } } },
        }));
        if (!motorista) {
            return eventos.map((_, index) => ({
                index,
                sucesso: false,
                erro: 'Motorista não encontrado',
            }));
        }
        return tenant_context_1.TenantContext.paraGrupo(motorista.empresa.grupoId, () => this.registrosJornada.processarLoteSequencial(motoristaId, deviceUuid, eventos, ip, userAgent));
    }
};
exports.LoteRegistrosJornadaProcessor = LoteRegistrosJornadaProcessor;
exports.LoteRegistrosJornadaProcessor = LoteRegistrosJornadaProcessor = LoteRegistrosJornadaProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(lote_registros_jornada_constants_1.FILA_LOTE_REGISTROS_JORNADA, {
        concurrency: Number(process.env.CONCORRENCIA_FILA_LOTE_PONTO ?? 10),
    }),
    __metadata("design:paramtypes", [registros_jornada_service_1.RegistrosJornadaService,
        prisma_service_1.PrismaService])
], LoteRegistrosJornadaProcessor);
//# sourceMappingURL=lote-registros-jornada.processor.js.map