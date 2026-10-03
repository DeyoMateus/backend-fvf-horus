"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashChainModule = void 0;
const common_1 = require("@nestjs/common");
const hash_chain_service_1 = require("./hash-chain.service");
let HashChainModule = class HashChainModule {
};
exports.HashChainModule = HashChainModule;
exports.HashChainModule = HashChainModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [hash_chain_service_1.HashChainService],
        exports: [hash_chain_service_1.HashChainService],
    })
], HashChainModule);
//# sourceMappingURL=hash-chain.module.js.map