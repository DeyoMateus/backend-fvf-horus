"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmostrasLocalizacaoModule = void 0;
const common_1 = require("@nestjs/common");
const amostras_localizacao_controller_1 = require("./amostras-localizacao.controller");
const amostras_localizacao_service_1 = require("./amostras-localizacao.service");
let AmostrasLocalizacaoModule = class AmostrasLocalizacaoModule {
};
exports.AmostrasLocalizacaoModule = AmostrasLocalizacaoModule;
exports.AmostrasLocalizacaoModule = AmostrasLocalizacaoModule = __decorate([
    (0, common_1.Module)({
        controllers: [amostras_localizacao_controller_1.AmostrasLocalizacaoController],
        providers: [amostras_localizacao_service_1.AmostrasLocalizacaoService],
    })
], AmostrasLocalizacaoModule);
//# sourceMappingURL=amostras-localizacao.module.js.map