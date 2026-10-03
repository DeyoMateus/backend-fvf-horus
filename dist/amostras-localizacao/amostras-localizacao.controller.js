"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmostrasLocalizacaoController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const amostras_localizacao_service_1 = require("./amostras-localizacao.service");
const create_amostras_localizacao_dto_1 = require("./dto/create-amostras-localizacao.dto");
let AmostrasLocalizacaoController = class AmostrasLocalizacaoController {
    service;
    constructor(service) {
        this.service = service;
    }
    registrar(req, dto) {
        return this.service.registrarLote(req.motorista.id, dto.amostras);
    }
};
exports.AmostrasLocalizacaoController = AmostrasLocalizacaoController;
__decorate([
    (0, common_1.Post)('amostras-localizacao'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_amostras_localizacao_dto_1.CreateAmostrasLocalizacaoDto]),
    __metadata("design:returntype", void 0)
], AmostrasLocalizacaoController.prototype, "registrar", null);
exports.AmostrasLocalizacaoController = AmostrasLocalizacaoController = __decorate([
    (0, common_1.Controller)('dispositivo'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [amostras_localizacao_service_1.AmostrasLocalizacaoService])
], AmostrasLocalizacaoController);
//# sourceMappingURL=amostras-localizacao.controller.js.map