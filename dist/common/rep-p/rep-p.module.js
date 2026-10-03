"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepPModule = void 0;
const common_1 = require("@nestjs/common");
const nsr_module_1 = require("../nsr/nsr.module");
const rep_p_service_1 = require("./rep-p.service");
let RepPModule = class RepPModule {
};
exports.RepPModule = RepPModule;
exports.RepPModule = RepPModule = __decorate([
    (0, common_1.Module)({
        imports: [nsr_module_1.NsrModule],
        providers: [rep_p_service_1.RepPService],
        exports: [rep_p_service_1.RepPService],
    })
], RepPModule);
//# sourceMappingURL=rep-p.module.js.map