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
var VerificacaoJornadaAgendadaProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificacaoJornadaAgendadaProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const verificacao_agendada_constants_1 = require("./verificacao-agendada.constants");
const registros_jornada_service_1 = require("./registros-jornada.service");
let VerificacaoJornadaAgendadaProcessor = VerificacaoJornadaAgendadaProcessor_1 = class VerificacaoJornadaAgendadaProcessor extends bullmq_1.WorkerHost {
    registrosJornada;
    logger = new common_1.Logger(VerificacaoJornadaAgendadaProcessor_1.name);
    constructor(registrosJornada) {
        super();
        this.registrosJornada = registrosJornada;
    }
    async process(job) {
        const { motoristaId } = job.data;
        try {
            await this.registrosJornada.verificarEAgendarProximoMotorista(motoristaId);
        }
        catch (err) {
            this.logger.warn(`Falha ao verificar motorista ${motoristaId} via job agendado: ${err.message}`);
            throw err;
        }
    }
};
exports.VerificacaoJornadaAgendadaProcessor = VerificacaoJornadaAgendadaProcessor;
exports.VerificacaoJornadaAgendadaProcessor = VerificacaoJornadaAgendadaProcessor = VerificacaoJornadaAgendadaProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(verificacao_agendada_constants_1.FILA_VERIFICACAO_JORNADA),
    __metadata("design:paramtypes", [registros_jornada_service_1.RegistrosJornadaService])
], VerificacaoJornadaAgendadaProcessor);
//# sourceMappingURL=verificacao-agendada.processor.js.map