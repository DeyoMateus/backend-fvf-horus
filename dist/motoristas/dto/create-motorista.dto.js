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
exports.CreateMotoristaDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class CreateMotoristaDto {
    nome;
    cpf;
    cnh;
    empresaId;
    placa;
    idRastreador;
    tecnologiaRastreador;
    telefone;
}
exports.CreateMotoristaDto = CreateMotoristaDto;
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 60),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "nome", void 0);
__decorate([
    (0, sanitizar_decorator_1.SomenteDigitos)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{11}$/, { message: 'cpf deve conter 11 dígitos numéricos' }),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "cpf", void 0);
__decorate([
    (0, sanitizar_decorator_1.SomenteDigitos)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 20),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "cnh", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "empresaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Za-z]{3}\d([A-Za-z]\d{2}|\d{3})$/, {
        message: 'placa inválida (use o formato antigo ABC1234 ou Mercosul ABC1D23)',
    }),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "placa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "idRastreador", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TecnologiaRastreador),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "tecnologiaRastreador", void 0);
__decorate([
    (0, sanitizar_decorator_1.NormalizarTelefone)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+\d{10,15}$/, {
        message: 'telefone deve estar em formato E.164 (ex.: +5511999998888)',
    }),
    __metadata("design:type", String)
], CreateMotoristaDto.prototype, "telefone", void 0);
//# sourceMappingURL=create-motorista.dto.js.map