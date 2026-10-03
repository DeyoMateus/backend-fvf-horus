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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VerificacaoJornadaAgendadaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificacaoJornadaAgendadaService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const verificacao_agendada_constants_1 = require("./verificacao-agendada.constants");
let VerificacaoJornadaAgendadaService = VerificacaoJornadaAgendadaService_1 = class VerificacaoJornadaAgendadaService {
    fila;
    logger = new common_1.Logger(VerificacaoJornadaAgendadaService_1.name);
    constructor(fila) {
        this.fila = fila;
    }
    async agendar(motoristaId, emMs) {
        try {
            const jobId = this.jobIdDoMotorista(motoristaId);
            const jobExistente = await this.fila.getJob(jobId);
            if (jobExistente) {
                const estado = await jobExistente.getState();
                if (estado === 'delayed' || estado === 'waiting') {
                    await jobExistente.remove();
                }
                else {
                    return;
                }
            }
            await this.fila.add('verificar', { motoristaId }, {
                jobId,
                delay: Math.max(0, emMs),
                removeOnComplete: true,
                removeOnFail: 50,
            });
        }
        catch (err) {
            this.logger.warn(`Falha ao agendar verificação proativa para motorista ${motoristaId}: ${err.message}`);
        }
    }
    async cancelar(motoristaId) {
        try {
            const job = await this.fila.getJob(this.jobIdDoMotorista(motoristaId));
            if (!job)
                return;
            const estado = await job.getState();
            if (estado === 'delayed' || estado === 'waiting')
                await job.remove();
        }
        catch (err) {
            this.logger.warn(`Falha ao cancelar verificação agendada para motorista ${motoristaId}: ${err.message}`);
        }
    }
    jobIdDoMotorista(motoristaId) {
        return `verificar-jornada:${motoristaId}`;
    }
};
exports.VerificacaoJornadaAgendadaService = VerificacaoJornadaAgendadaService;
exports.VerificacaoJornadaAgendadaService = VerificacaoJornadaAgendadaService = VerificacaoJornadaAgendadaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(verificacao_agendada_constants_1.FILA_VERIFICACAO_JORNADA)),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], VerificacaoJornadaAgendadaService);
//# sourceMappingURL=verificacao-agendada.service.js.map