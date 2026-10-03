"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolgaConcedidaModule = void 0;
const common_1 = require("@nestjs/common");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
const folga_concedida_controller_1 = require("./folga-concedida.controller");
const folga_concedida_mobile_controller_1 = require("./folga-concedida-mobile.controller");
const folga_concedida_service_1 = require("./folga-concedida.service");
let FolgaConcedidaModule = class FolgaConcedidaModule {
};
exports.FolgaConcedidaModule = FolgaConcedidaModule;
exports.FolgaConcedidaModule = FolgaConcedidaModule = __decorate([
    (0, common_1.Module)({
        imports: [push_notifications_module_1.PushNotificationsModule],
        controllers: [folga_concedida_controller_1.FolgaConcedidaController, folga_concedida_mobile_controller_1.FolgaConcedidaMobileController],
        providers: [folga_concedida_service_1.FolgaConcedidaService],
        exports: [folga_concedida_service_1.FolgaConcedidaService],
    })
], FolgaConcedidaModule);
//# sourceMappingURL=folga-concedida.module.js.map