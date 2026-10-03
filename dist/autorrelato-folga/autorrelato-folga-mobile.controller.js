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
exports.AutorrelatoFolgaMobileController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const autorrelato_folga_service_1 = require("./autorrelato-folga.service");
const create_autorrelato_folga_dto_1 = require("./dto/create-autorrelato-folga.dto");
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
let AutorrelatoFolgaMobileController = class AutorrelatoFolgaMobileController {
    service;
    constructor(service) {
        this.service = service;
    }
    autorrelatar(req, dto) {
        return this.service.autorrelatar(req.motorista.id, dto);
    }
    listarMinhas(req) {
        return this.service.listarMinhas(req.motorista.id);
    }
    anular(req, data) {
        if (!REGEX_DATA_ISO.test(data)) {
            throw new common_1.BadRequestException('Data inválida , use o formato AAAA-MM-DD.');
        }
        return this.service.anular(req.motorista.id, data);
    }
};
exports.AutorrelatoFolgaMobileController = AutorrelatoFolgaMobileController;
__decorate([
    (0, common_1.Post)('autorrelato-folga'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_autorrelato_folga_dto_1.CreateAutorrelatoFolgaDto]),
    __metadata("design:returntype", void 0)
], AutorrelatoFolgaMobileController.prototype, "autorrelatar", null);
__decorate([
    (0, common_1.Get)('autorrelatos-folga'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutorrelatoFolgaMobileController.prototype, "listarMinhas", null);
__decorate([
    (0, common_1.Delete)('autorrelato-folga/:data'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('data')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutorrelatoFolgaMobileController.prototype, "anular", null);
exports.AutorrelatoFolgaMobileController = AutorrelatoFolgaMobileController = __decorate([
    (0, common_1.Controller)('dispositivo'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [autorrelato_folga_service_1.AutorrelatoFolgaService])
], AutorrelatoFolgaMobileController);
//# sourceMappingURL=autorrelato-folga-mobile.controller.js.map