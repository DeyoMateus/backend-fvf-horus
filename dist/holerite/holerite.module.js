"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HoleriteModule = void 0;
const common_1 = require("@nestjs/common");
const fechamento_holerite_controller_1 = require("./fechamento-holerite.controller");
const holerite_controller_1 = require("./holerite.controller");
const holerite_service_1 = require("./holerite.service");
let HoleriteModule = class HoleriteModule {
};
exports.HoleriteModule = HoleriteModule;
exports.HoleriteModule = HoleriteModule = __decorate([
    (0, common_1.Module)({
        controllers: [holerite_controller_1.HoleriteController, fechamento_holerite_controller_1.FechamentoHoleriteController],
        providers: [holerite_service_1.HoleriteService],
        exports: [holerite_service_1.HoleriteService],
    })
], HoleriteModule);
//# sourceMappingURL=holerite.module.js.map