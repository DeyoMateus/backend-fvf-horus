"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolicitacoesAjustePontoModule = void 0;
const common_1 = require("@nestjs/common");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
const storage_module_1 = require("../common/storage/storage.module");
const tratamentos_ponto_module_1 = require("../tratamentos-ponto/tratamentos-ponto.module");
const solicitacoes_ajuste_ponto_controller_1 = require("./solicitacoes-ajuste-ponto.controller");
const solicitacoes_ajuste_ponto_mobile_controller_1 = require("./solicitacoes-ajuste-ponto-mobile.controller");
const solicitacoes_ajuste_ponto_service_1 = require("./solicitacoes-ajuste-ponto.service");
let SolicitacoesAjustePontoModule = class SolicitacoesAjustePontoModule {
};
exports.SolicitacoesAjustePontoModule = SolicitacoesAjustePontoModule;
exports.SolicitacoesAjustePontoModule = SolicitacoesAjustePontoModule = __decorate([
    (0, common_1.Module)({
        imports: [storage_module_1.StorageModule, push_notifications_module_1.PushNotificationsModule, tratamentos_ponto_module_1.TratamentosPontoModule],
        controllers: [
            solicitacoes_ajuste_ponto_controller_1.SolicitacoesAjustePontoGeralController,
            solicitacoes_ajuste_ponto_controller_1.SolicitacoesAjustePontoPorMotoristaController,
            solicitacoes_ajuste_ponto_mobile_controller_1.SolicitacoesAjustePontoMobileController,
        ],
        providers: [solicitacoes_ajuste_ponto_service_1.SolicitacoesAjustePontoService],
        exports: [solicitacoes_ajuste_ponto_service_1.SolicitacoesAjustePontoService],
    })
], SolicitacoesAjustePontoModule);
//# sourceMappingURL=solicitacoes-ajuste-ponto.module.js.map