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
exports.AtualizarVeiculoDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class AtualizarVeiculoDto {
    placa;
    idRastreador;
    tecnologiaRastreador;
}
exports.AtualizarVeiculoDto = AtualizarVeiculoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Za-z]{3}\d([A-Za-z]\d{2}|\d{3})$/, {
        message: 'placa inválida (use o formato antigo ABC1234 ou Mercosul ABC1D23)',
    }),
    __metadata("design:type", String)
], AtualizarVeiculoDto.prototype, "placa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], AtualizarVeiculoDto.prototype, "idRastreador", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TecnologiaRastreador),
    __metadata("design:type", String)
], AtualizarVeiculoDto.prototype, "tecnologiaRastreador", void 0);
//# sourceMappingURL=atualizar-veiculo.dto.js.map