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
exports.AtualizarEncarregadoDto = exports.ResponderSolicitacaoTitularDto = exports.CriarSolicitacaoTitularDto = exports.RegistrarAceiteDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class RegistrarAceiteDto {
    tipoDocumento;
    versao;
    aceitoLocalEm;
}
exports.RegistrarAceiteDto = RegistrarAceiteDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TipoDocumentoPrivacidade),
    __metadata("design:type", String)
], RegistrarAceiteDto.prototype, "tipoDocumento", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 30),
    __metadata("design:type", String)
], RegistrarAceiteDto.prototype, "versao", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], RegistrarAceiteDto.prototype, "aceitoLocalEm", void 0);
class CriarSolicitacaoTitularDto {
    tipo;
    descricao;
}
exports.CriarSolicitacaoTitularDto = CriarSolicitacaoTitularDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TipoSolicitacaoTitular),
    __metadata("design:type", String)
], CriarSolicitacaoTitularDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 1000),
    __metadata("design:type", String)
], CriarSolicitacaoTitularDto.prototype, "descricao", void 0);
class ResponderSolicitacaoTitularDto {
    status;
    resposta;
}
exports.ResponderSolicitacaoTitularDto = ResponderSolicitacaoTitularDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.StatusSolicitacaoTitular),
    __metadata("design:type", String)
], ResponderSolicitacaoTitularDto.prototype, "status", void 0);
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 2000),
    __metadata("design:type", String)
], ResponderSolicitacaoTitularDto.prototype, "resposta", void 0);
class AtualizarEncarregadoDto {
    nome;
    email;
    telefone;
}
exports.AtualizarEncarregadoDto = AtualizarEncarregadoDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 120),
    __metadata("design:type", String)
], AtualizarEncarregadoDto.prototype, "nome", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !!o.email),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.Length)(5, 160),
    __metadata("design:type", String)
], AtualizarEncarregadoDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !!o.telefone),
    (0, class_validator_1.Matches)(/^\+\d{10,15}$/, { message: 'telefone deve estar em formato E.164' }),
    __metadata("design:type", String)
], AtualizarEncarregadoDto.prototype, "telefone", void 0);
//# sourceMappingURL=privacidade.dto.js.map