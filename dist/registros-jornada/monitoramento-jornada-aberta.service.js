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
var MonitoramentoJornadaAbertaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoramentoJornadaAbertaService = void 0;
const common_1 = require("@nestjs/common");
const registros_jornada_service_1 = require("./registros-jornada.service");
let MonitoramentoJornadaAbertaService = MonitoramentoJornadaAbertaService_1 = class MonitoramentoJornadaAbertaService {
    registrosJornada;
    logger = new common_1.Logger(MonitoramentoJornadaAbertaService_1.name);
    timer = null;
    emExecucao = false;
    constructor(registrosJornada) {
        this.registrosJornada = registrosJornada;
    }
    onModuleInit() {
        if (process.env.NODE_ENV === 'test')
            return;
        const intervaloMs = Number(process.env.INTERVALO_VERIFICACAO_JORNADA_ABERTA_MS ?? 30 * 60 * 1000);
        this.timer = setInterval(() => void this.executar(), intervaloMs);
        void this.executar();
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
            const quantidade = await this.registrosJornada.verificarJornadasAbertasProativamente();
            this.logger.log(`Varredura de jornadas abertas concluída: ${quantidade} motorista(s) com jornada aberta avaliado(s).`);
        }
        catch (err) {
            this.logger.warn(`Falha na verificação proativa de jornadas abertas: ${err.message}`);
        }
        finally {
            this.emExecucao = false;
        }
    }
};
exports.MonitoramentoJornadaAbertaService = MonitoramentoJornadaAbertaService;
exports.MonitoramentoJornadaAbertaService = MonitoramentoJornadaAbertaService = MonitoramentoJornadaAbertaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [registros_jornada_service_1.RegistrosJornadaService])
], MonitoramentoJornadaAbertaService);
//# sourceMappingURL=monitoramento-jornada-aberta.service.js.map