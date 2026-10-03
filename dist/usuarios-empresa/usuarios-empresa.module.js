"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsuariosEmpresaModule = void 0;
const common_1 = require("@nestjs/common");
const usuarios_empresa_controller_1 = require("./usuarios-empresa.controller");
const usuarios_empresa_service_1 = require("./usuarios-empresa.service");
let UsuariosEmpresaModule = class UsuariosEmpresaModule {
};
exports.UsuariosEmpresaModule = UsuariosEmpresaModule;
exports.UsuariosEmpresaModule = UsuariosEmpresaModule = __decorate([
    (0, common_1.Module)({
        controllers: [usuarios_empresa_controller_1.UsuariosEmpresaController],
        providers: [usuarios_empresa_service_1.UsuariosEmpresaService],
    })
], UsuariosEmpresaModule);
//# sourceMappingURL=usuarios-empresa.module.js.map