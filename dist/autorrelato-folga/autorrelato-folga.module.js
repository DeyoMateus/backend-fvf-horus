"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutorrelatoFolgaModule = void 0;
const common_1 = require("@nestjs/common");
const push_notifications_module_1 = require("../common/notifications/push-notifications.module");
const autorrelato_folga_controller_1 = require("./autorrelato-folga.controller");
const autorrelato_folga_mobile_controller_1 = require("./autorrelato-folga-mobile.controller");
const autorrelato_folga_service_1 = require("./autorrelato-folga.service");
let AutorrelatoFolgaModule = class AutorrelatoFolgaModule {
};
exports.AutorrelatoFolgaModule = AutorrelatoFolgaModule;
exports.AutorrelatoFolgaModule = AutorrelatoFolgaModule = __decorate([
    (0, common_1.Module)({
        imports: [push_notifications_module_1.PushNotificationsModule],
        controllers: [autorrelato_folga_controller_1.AutorrelatoFolgaController, autorrelato_folga_mobile_controller_1.AutorrelatoFolgaMobileController],
        providers: [autorrelato_folga_service_1.AutorrelatoFolgaService],
    })
], AutorrelatoFolgaModule);
//# sourceMappingURL=autorrelato-folga.module.js.map