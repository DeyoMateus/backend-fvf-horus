"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FechamentoFiscalModule = void 0;
const common_1 = require("@nestjs/common");
const feriados_module_1 = require("../feriados/feriados.module");
const rep_p_module_1 = require("../common/rep-p/rep-p.module");
const registros_jornada_module_1 = require("../registros-jornada/registros-jornada.module");
const fechamento_fiscal_controller_1 = require("./fechamento-fiscal.controller");
const fechamento_fiscal_service_1 = require("./fechamento-fiscal.service");
let FechamentoFiscalModule = class FechamentoFiscalModule {
};
exports.FechamentoFiscalModule = FechamentoFiscalModule;
exports.FechamentoFiscalModule = FechamentoFiscalModule = __decorate([
    (0, common_1.Module)({
        imports: [feriados_module_1.FeriadosModule, rep_p_module_1.RepPModule, registros_jornada_module_1.RegistrosJornadaModule],
        controllers: [fechamento_fiscal_controller_1.FechamentoFiscalController],
        providers: [fechamento_fiscal_service_1.FechamentoFiscalService],
    })
], FechamentoFiscalModule);
//# sourceMappingURL=fechamento-fiscal.module.js.map