"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrosJornadaModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const aej_module_1 = require("../common/aej/aej.module");
const antifraude_module_1 = require("../common/antifraude/antifraude.module");
const comprovante_module_1 = require("../common/comprovante/comprovante.module");
const jornada_legal_module_1 = require("../common/jornada-legal/jornada-legal.module");
const rep_p_module_1 = require("../common/rep-p/rep-p.module");
const feriados_module_1 = require("../feriados/feriados.module");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
const ancora_integridade_service_1 = require("./ancora-integridade.service");
const monitoramento_integridade_cadeia_service_1 = require("./monitoramento-integridade-cadeia.service");
const monitoramento_jornada_aberta_service_1 = require("./monitoramento-jornada-aberta.service");
const registros_jornada_controller_1 = require("./registros-jornada.controller");
const registros_jornada_service_1 = require("./registros-jornada.service");
const verificacao_agendada_constants_1 = require("./verificacao-agendada.constants");
const lote_registros_jornada_constants_1 = require("./lote-registros-jornada.constants");
const lote_registros_jornada_processor_1 = require("./lote-registros-jornada.processor");
const verificacao_agendada_processor_1 = require("./verificacao-agendada.processor");
const verificacao_agendada_service_1 = require("./verificacao-agendada.service");
let RegistrosJornadaModule = class RegistrosJornadaModule {
};
exports.RegistrosJornadaModule = RegistrosJornadaModule;
exports.RegistrosJornadaModule = RegistrosJornadaModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jornada_legal_module_1.JornadaLegalModule,
            antifraude_module_1.AntifraudeModule,
            push_notifications_module_1.PushNotificationsModule,
            comprovante_module_1.ComprovanteModule,
            aej_module_1.AejModule,
            rep_p_module_1.RepPModule,
            feriados_module_1.FeriadosModule,
            bullmq_1.BullModule.registerQueue({ name: verificacao_agendada_constants_1.FILA_VERIFICACAO_JORNADA }),
            bullmq_1.BullModule.registerQueue({ name: lote_registros_jornada_constants_1.FILA_LOTE_REGISTROS_JORNADA }),
        ],
        controllers: [registros_jornada_controller_1.RegistrosJornadaController],
        providers: [
            registros_jornada_service_1.RegistrosJornadaService,
            monitoramento_jornada_aberta_service_1.MonitoramentoJornadaAbertaService,
            monitoramento_integridade_cadeia_service_1.MonitoramentoIntegridadeCadeiaService,
            ancora_integridade_service_1.AncoraIntegridadeService,
            verificacao_agendada_service_1.VerificacaoJornadaAgendadaService,
            verificacao_agendada_processor_1.VerificacaoJornadaAgendadaProcessor,
            lote_registros_jornada_processor_1.LoteRegistrosJornadaProcessor,
        ],
        exports: [registros_jornada_service_1.RegistrosJornadaService],
    })
], RegistrosJornadaModule);
//# sourceMappingURL=registros-jornada.module.js.map