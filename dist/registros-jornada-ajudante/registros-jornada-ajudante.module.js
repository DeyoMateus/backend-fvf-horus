"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrosJornadaAjudanteModule = void 0;
const common_1 = require("@nestjs/common");
const registros_jornada_ajudante_controller_1 = require("./registros-jornada-ajudante.controller");
const registros_jornada_ajudante_service_1 = require("./registros-jornada-ajudante.service");
let RegistrosJornadaAjudanteModule = class RegistrosJornadaAjudanteModule {
};
exports.RegistrosJornadaAjudanteModule = RegistrosJornadaAjudanteModule;
exports.RegistrosJornadaAjudanteModule = RegistrosJornadaAjudanteModule = __decorate([
    (0, common_1.Module)({
        controllers: [registros_jornada_ajudante_controller_1.RegistrosJornadaAjudanteController],
        providers: [registros_jornada_ajudante_service_1.RegistrosJornadaAjudanteService],
        exports: [registros_jornada_ajudante_service_1.RegistrosJornadaAjudanteService],
    })
], RegistrosJornadaAjudanteModule);
//# sourceMappingURL=registros-jornada-ajudante.module.js.map