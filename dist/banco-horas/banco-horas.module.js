"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BancoHorasModule = void 0;
const common_1 = require("@nestjs/common");
const holerite_module_1 = require("../holerite/holerite.module");
const banco_horas_controller_1 = require("./banco-horas.controller");
const banco_horas_service_1 = require("./banco-horas.service");
let BancoHorasModule = class BancoHorasModule {
};
exports.BancoHorasModule = BancoHorasModule;
exports.BancoHorasModule = BancoHorasModule = __decorate([
    (0, common_1.Module)({
        imports: [holerite_module_1.HoleriteModule],
        controllers: [banco_horas_controller_1.BancoHorasController],
        providers: [banco_horas_service_1.BancoHorasService],
        exports: [banco_horas_service_1.BancoHorasService],
    })
], BancoHorasModule);
//# sourceMappingURL=banco-horas.module.js.map