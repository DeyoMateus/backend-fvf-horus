"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolicitacoesFolgaModule = void 0;
const common_1 = require("@nestjs/common");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
const folga_concedida_module_1 = require("../folga-concedida/folga-concedida.module");
const solicitacoes_folga_controller_1 = require("./solicitacoes-folga.controller");
const solicitacoes_folga_mobile_controller_1 = require("./solicitacoes-folga-mobile.controller");
const solicitacoes_folga_service_1 = require("./solicitacoes-folga.service");
let SolicitacoesFolgaModule = class SolicitacoesFolgaModule {
};
exports.SolicitacoesFolgaModule = SolicitacoesFolgaModule;
exports.SolicitacoesFolgaModule = SolicitacoesFolgaModule = __decorate([
    (0, common_1.Module)({
        imports: [push_notifications_module_1.PushNotificationsModule, folga_concedida_module_1.FolgaConcedidaModule],
        controllers: [
            solicitacoes_folga_controller_1.SolicitacoesFolgaGeralController,
            solicitacoes_folga_controller_1.SolicitacoesFolgaPorMotoristaController,
            solicitacoes_folga_mobile_controller_1.SolicitacoesFolgaMobileController,
        ],
        providers: [solicitacoes_folga_service_1.SolicitacoesFolgaService],
        exports: [solicitacoes_folga_service_1.SolicitacoesFolgaService],
    })
], SolicitacoesFolgaModule);
//# sourceMappingURL=solicitacoes-folga.module.js.map