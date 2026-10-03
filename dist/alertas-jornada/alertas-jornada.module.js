"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertasJornadaModule = void 0;
const common_1 = require("@nestjs/common");
const alertas_jornada_controller_1 = require("./alertas-jornada.controller");
const alertas_jornada_mobile_controller_1 = require("./alertas-jornada-mobile.controller");
const alertas_jornada_service_1 = require("./alertas-jornada.service");
let AlertasJornadaModule = class AlertasJornadaModule {
};
exports.AlertasJornadaModule = AlertasJornadaModule;
exports.AlertasJornadaModule = AlertasJornadaModule = __decorate([
    (0, common_1.Module)({
        controllers: [alertas_jornada_controller_1.AlertasJornadaController, alertas_jornada_mobile_controller_1.AlertasJornadaMobileController],
        providers: [alertas_jornada_service_1.AlertasJornadaService],
        exports: [alertas_jornada_service_1.AlertasJornadaService],
    })
], AlertasJornadaModule);
//# sourceMappingURL=alertas-jornada.module.js.map