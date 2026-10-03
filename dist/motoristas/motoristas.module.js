"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoristasModule = void 0;
const common_1 = require("@nestjs/common");
const banco_horas_module_1 = require("../banco-horas/banco-horas.module");
const holerite_module_1 = require("../holerite/holerite.module");
const motoristas_controller_1 = require("./motoristas.controller");
const motoristas_mobile_controller_1 = require("./motoristas-mobile.controller");
const motoristas_service_1 = require("./motoristas.service");
let MotoristasModule = class MotoristasModule {
};
exports.MotoristasModule = MotoristasModule;
exports.MotoristasModule = MotoristasModule = __decorate([
    (0, common_1.Module)({
        imports: [holerite_module_1.HoleriteModule, banco_horas_module_1.BancoHorasModule],
        controllers: [motoristas_controller_1.MotoristasController, motoristas_mobile_controller_1.MotoristasMobileController],
        providers: [motoristas_service_1.MotoristasService],
        exports: [motoristas_service_1.MotoristasService],
    })
], MotoristasModule);
//# sourceMappingURL=motoristas.module.js.map