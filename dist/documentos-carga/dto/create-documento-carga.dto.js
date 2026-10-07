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
exports.CreateDocumentoCargaDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class CreateDocumentoCargaDto {
    tipo;
    statusCarga;
    motoristaId;
    empresaId;
    numero;
    chaveAcesso;
    observacao;
}
exports.CreateDocumentoCargaDto = CreateDocumentoCargaDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TipoDocumentoCarga),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.StatusCargaViagem),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "statusCarga", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "motoristaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "empresaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{44}$/, {
        message: 'chaveAcesso deve ter exatamente 44 dígitos',
    }),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "chaveAcesso", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 400),
    __metadata("design:type", String)
], CreateDocumentoCargaDto.prototype, "observacao", void 0);
//# sourceMappingURL=create-documento-carga.dto.js.map