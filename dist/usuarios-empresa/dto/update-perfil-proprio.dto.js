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
exports.UpdatePerfilProprioDto = void 0;
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class UpdatePerfilProprioDto {
    nome;
    email;
    telefoneWhatsapp;
    telefoneGerenciamentoRisco;
}
exports.UpdatePerfilProprioDto = UpdatePerfilProprioDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 60),
    __metadata("design:type", String)
], UpdatePerfilProprioDto.prototype, "nome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], UpdatePerfilProprioDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.NormalizarTelefone)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+\d{10,15}$/, {
        message: 'telefoneWhatsapp deve estar em formato E.164, ex.: +5511999998888',
    }),
    __metadata("design:type", String)
], UpdatePerfilProprioDto.prototype, "telefoneWhatsapp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.NormalizarTelefone)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+\d{10,15}$/, {
        message: 'telefoneGerenciamentoRisco deve estar em formato E.164, ex.: +5511999998888',
    }),
    __metadata("design:type", Object)
], UpdatePerfilProprioDto.prototype, "telefoneGerenciamentoRisco", void 0);
//# sourceMappingURL=update-perfil-proprio.dto.js.map