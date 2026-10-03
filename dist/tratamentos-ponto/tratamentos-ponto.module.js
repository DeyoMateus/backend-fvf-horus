"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TratamentosPontoModule = void 0;
const common_1 = require("@nestjs/common");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
const storage_module_1 = require("../common/storage/storage.module");
const registros_jornada_module_1 = require("../registros-jornada/registros-jornada.module");
const tratamentos_ponto_controller_1 = require("./tratamentos-ponto.controller");
const tratamentos_ponto_mobile_controller_1 = require("./tratamentos-ponto-mobile.controller");
const tratamentos_ponto_service_1 = require("./tratamentos-ponto.service");
let TratamentosPontoModule = class TratamentosPontoModule {
};
exports.TratamentosPontoModule = TratamentosPontoModule;
exports.TratamentosPontoModule = TratamentosPontoModule = __decorate([
    (0, common_1.Module)({
        imports: [storage_module_1.StorageModule, push_notifications_module_1.PushNotificationsModule, registros_jornada_module_1.RegistrosJornadaModule],
        controllers: [tratamentos_ponto_controller_1.TratamentosPontoController, tratamentos_ponto_mobile_controller_1.TratamentosPontoMobileController],
        providers: [tratamentos_ponto_service_1.TratamentosPontoService],
        exports: [tratamentos_ponto_service_1.TratamentosPontoService],
    })
], TratamentosPontoModule);
//# sourceMappingURL=tratamentos-ponto.module.js.map