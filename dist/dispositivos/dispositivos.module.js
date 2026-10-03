"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispositivosModule = void 0;
const common_1 = require("@nestjs/common");
const relogio_confiavel_module_1 = require("../common/relogio-confiavel/relogio-confiavel.module");
const dispositivos_controller_1 = require("./dispositivos.controller");
const dispositivos_mobile_controller_1 = require("./dispositivos-mobile.controller");
const solicitacoes_troca_dispositivo_controller_1 = require("./solicitacoes-troca-dispositivo.controller");
const dispositivos_service_1 = require("./dispositivos.service");
let DispositivosModule = class DispositivosModule {
};
exports.DispositivosModule = DispositivosModule;
exports.DispositivosModule = DispositivosModule = __decorate([
    (0, common_1.Module)({
        imports: [relogio_confiavel_module_1.RelogioConfiavelModule],
        controllers: [dispositivos_controller_1.DispositivosController, dispositivos_mobile_controller_1.DispositivosMobileController, solicitacoes_troca_dispositivo_controller_1.SolicitacoesTrocaDispositivoController],
        providers: [dispositivos_service_1.DispositivosService],
        exports: [dispositivos_service_1.DispositivosService],
    })
], DispositivosModule);
//# sourceMappingURL=dispositivos.module.js.map