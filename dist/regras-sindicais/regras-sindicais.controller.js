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
exports.RegrasSindicaisController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const create_regra_sindical_dto_1 = require("./dto/create-regra-sindical.dto");
const update_regra_sindical_dto_1 = require("./dto/update-regra-sindical.dto");
const regras_sindicais_service_1 = require("./regras-sindicais.service");
let RegrasSindicaisController = class RegrasSindicaisController {
    regrasService;
    constructor(regrasService) {
        this.regrasService = regrasService;
    }
    create(dto, user) {
        return this.regrasService.create(dto, user.grupoId, user.sub);
    }
    list(user) {
        return this.regrasService.list(user.grupoId);
    }
    findOne(id, user) {
        return this.regrasService.findById(id, user.grupoId);
    }
    update(id, dto, user) {
        return this.regrasService.update(id, dto, user.grupoId, user.sub);
    }
    desativar(id, user) {
        return this.regrasService.desativar(id, user.grupoId, user.sub);
    }
};
exports.RegrasSindicaisController = RegrasSindicaisController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_regra_sindical_dto_1.CreateRegraSindicalDto, Object]),
    __metadata("design:returntype", void 0)
], RegrasSindicaisController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RegrasSindicaisController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RegrasSindicaisController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_regra_sindical_dto_1.UpdateRegraSindicalDto, Object]),
    __metadata("design:returntype", void 0)
], RegrasSindicaisController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RegrasSindicaisController.prototype, "desativar", null);
exports.RegrasSindicaisController = RegrasSindicaisController = __decorate([
    (0, common_1.Controller)('regras-sindicais'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [regras_sindicais_service_1.RegrasSindicaisService])
], RegrasSindicaisController);
//# sourceMappingURL=regras-sindicais.controller.js.map