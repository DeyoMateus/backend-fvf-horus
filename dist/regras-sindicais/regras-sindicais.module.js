"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegrasSindicaisModule = void 0;
const common_1 = require("@nestjs/common");
const regras_sindicais_controller_1 = require("./regras-sindicais.controller");
const regras_sindicais_service_1 = require("./regras-sindicais.service");
let RegrasSindicaisModule = class RegrasSindicaisModule {
};
exports.RegrasSindicaisModule = RegrasSindicaisModule;
exports.RegrasSindicaisModule = RegrasSindicaisModule = __decorate([
    (0, common_1.Module)({
        controllers: [regras_sindicais_controller_1.RegrasSindicaisController],
        providers: [regras_sindicais_service_1.RegrasSindicaisService],
        exports: [regras_sindicais_service_1.RegrasSindicaisService],
    })
], RegrasSindicaisModule);
//# sourceMappingURL=regras-sindicais.module.js.map