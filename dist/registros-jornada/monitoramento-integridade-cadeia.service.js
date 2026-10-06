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
var MonitoramentoIntegridadeCadeiaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoramentoIntegridadeCadeiaService = void 0;
const common_1 = require("@nestjs/common");
const registros_jornada_service_1 = require("./registros-jornada.service");
let MonitoramentoIntegridadeCadeiaService = MonitoramentoIntegridadeCadeiaService_1 = class MonitoramentoIntegridadeCadeiaService {
    registrosJornada;
    logger = new common_1.Logger(MonitoramentoIntegridadeCadeiaService_1.name);
    timer = null;
    emExecucao = false;
    constructor(registrosJornada) {
        this.registrosJornada = registrosJornada;
    }
    onModuleInit() {
        if (process.env.NODE_ENV === 'test')
            return;
        const intervaloMs = Number(process.env.INTERVALO_VERIFICACAO_INTEGRIDADE_MS ?? 60 * 60 * 1000);
        this.timer = setInterval(() => void this.executar(), intervaloMs);
        setTimeout(() => void this.executar(), 60_000).unref();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async executar() {
        if (this.emExecucao)
            return;
        this.emExecucao = true;
        try {
            const r = await this.registrosJornada.varrerIntegridadeCadeias();
            this.logger.log(`Varredura de integridade: ${r.verificados} motorista(s), ${r.comViolacao} com divergência pendente, ${r.alertasCriados} alerta(s) novo(s).`);
        }
        catch (err) {
            this.logger.warn(`Falha na varredura de integridade: ${err.message}`);
        }
        finally {
            this.emExecucao = false;
        }
    }
};
exports.MonitoramentoIntegridadeCadeiaService = MonitoramentoIntegridadeCadeiaService;
exports.MonitoramentoIntegridadeCadeiaService = MonitoramentoIntegridadeCadeiaService = MonitoramentoIntegridadeCadeiaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [registros_jornada_service_1.RegistrosJornadaService])
], MonitoramentoIntegridadeCadeiaService);
//# sourceMappingURL=monitoramento-integridade-cadeia.service.js.map