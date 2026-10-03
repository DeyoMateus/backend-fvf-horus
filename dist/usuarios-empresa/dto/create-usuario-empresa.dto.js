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
exports.CreateUsuarioEmpresaDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class CreateUsuarioEmpresaDto {
    nome;
    email;
    senha;
    papel;
    telefoneWhatsapp;
}
exports.CreateUsuarioEmpresaDto = CreateUsuarioEmpresaDto;
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 60),
    __metadata("design:type", String)
], CreateUsuarioEmpresaDto.prototype, "nome", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateUsuarioEmpresaDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], CreateUsuarioEmpresaDto.prototype, "senha", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.PapelUsuario),
    __metadata("design:type", String)
], CreateUsuarioEmpresaDto.prototype, "papel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.NormalizarTelefone)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+\d{10,15}$/, {
        message: 'telefoneWhatsapp deve estar em formato E.164 (ex.: +5511999998888)',
    }),
    __metadata("design:type", String)
], CreateUsuarioEmpresaDto.prototype, "telefoneWhatsapp", void 0);
//# sourceMappingURL=create-usuario-empresa.dto.js.map