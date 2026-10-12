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
exports.SolicitacoesFolgaMobileController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const create_solicitacao_folga_dto_1 = require("./dto/create-solicitacao-folga.dto");
const solicitacoes_folga_service_1 = require("./solicitacoes-folga.service");
let SolicitacoesFolgaMobileController = class SolicitacoesFolgaMobileController {
    service;
    constructor(service) {
        this.service = service;
    }
    criar(req, dto) {
        return this.service.criar(req.motorista.id, dto);
    }
    listarMinhas(req) {
        return this.service.listarMinhas(req.motorista.id);
    }
};
exports.SolicitacoesFolgaMobileController = SolicitacoesFolgaMobileController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_solicitacao_folga_dto_1.CreateSolicitacaoFolgaDto]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaMobileController.prototype, "criar", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaMobileController.prototype, "listarMinhas", null);
exports.SolicitacoesFolgaMobileController = SolicitacoesFolgaMobileController = __decorate([
    (0, common_1.Controller)('dispositivo/minhas-solicitacoes-folga'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [solicitacoes_folga_service_1.SolicitacoesFolgaService])
], SolicitacoesFolgaMobileController);
//# sourceMappingURL=solicitacoes-folga-mobile.controller.js.map