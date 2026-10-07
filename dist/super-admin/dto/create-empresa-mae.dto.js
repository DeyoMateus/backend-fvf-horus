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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateEmpresaMaeDto = void 0;
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class CreateEmpresaMaeDto {
    razaoSocialGrupo;
    cnpjEmpresa;
    razaoSocialEmpresa;
    nomeAdmin;
    emailAdmin;
    senhaAdmin;
    registroInpiAfd;
}
exports.CreateEmpresaMaeDto = CreateEmpresaMaeDto;
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 200),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "razaoSocialGrupo", void 0);
__decorate([
    (0, sanitizar_decorator_1.SomenteDigitos)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{14}$/, {
        message: 'cnpjEmpresa deve conter 14 dígitos numéricos',
    }),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "cnpjEmpresa", void 0);
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 200),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "razaoSocialEmpresa", void 0);
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 60),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "nomeAdmin", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "emailAdmin", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "senhaAdmin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 200),
    __metadata("design:type", String)
], CreateEmpresaMaeDto.prototype, "registroInpiAfd", void 0);
//# sourceMappingURL=create-empresa-mae.dto.js.map