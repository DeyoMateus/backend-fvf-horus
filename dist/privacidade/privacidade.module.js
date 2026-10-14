"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacidadeModule = void 0;
const common_1 = require("@nestjs/common");
const privacidade_controller_1 = require("./privacidade.controller");
const privacidade_service_1 = require("./privacidade.service");
const privacidade_aviso_politica_service_1 = require("./privacidade-aviso-politica.service");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
let PrivacidadeModule = class PrivacidadeModule {
};
exports.PrivacidadeModule = PrivacidadeModule;
exports.PrivacidadeModule = PrivacidadeModule = __decorate([
    (0, common_1.Module)({
        imports: [push_notifications_module_1.PushNotificationsModule],
        controllers: [
            privacidade_controller_1.PrivacidadePublicaController,
            privacidade_controller_1.PrivacidadeMobileController,
            privacidade_controller_1.PrivacidadePainelController,
        ],
        providers: [privacidade_service_1.PrivacidadeService, privacidade_aviso_politica_service_1.PrivacidadeAvisoPoliticaService],
    })
], PrivacidadeModule);
//# sourceMappingURL=privacidade.module.js.map