"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VeiculosModule = void 0;
const common_1 = require("@nestjs/common");
const veiculos_controller_1 = require("./veiculos.controller");
const veiculos_mobile_controller_1 = require("./veiculos-mobile.controller");
const veiculos_service_1 = require("./veiculos.service");
let VeiculosModule = class VeiculosModule {
};
exports.VeiculosModule = VeiculosModule;
exports.VeiculosModule = VeiculosModule = __decorate([
    (0, common_1.Module)({
        controllers: [veiculos_controller_1.VeiculosController, veiculos_mobile_controller_1.VeiculosMobileController],
        providers: [veiculos_service_1.VeiculosService],
        exports: [veiculos_service_1.VeiculosService],
    })
], VeiculosModule);
//# sourceMappingURL=veiculos.module.js.map