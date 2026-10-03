"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureModule = void 0;
const common_1 = require("@nestjs/common");
const certificate_service_1 = require("./certificate.service");
const signature_service_1 = require("./signature.service");
let SignatureModule = class SignatureModule {
};
exports.SignatureModule = SignatureModule;
exports.SignatureModule = SignatureModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [certificate_service_1.CertificateService, signature_service_1.SignatureService],
        exports: [certificate_service_1.CertificateService, signature_service_1.SignatureService],
    })
], SignatureModule);
//# sourceMappingURL=signature.module.js.map