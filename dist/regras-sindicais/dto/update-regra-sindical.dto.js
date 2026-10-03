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
exports.UpdateRegraSindicalDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class UpdateRegraSindicalDto {
    nome;
    categoriaTransporte;
    toleranciaMarcacaoMin;
    limiteJornadaNormalMin;
    limiteHoraExtraFaixa1Min;
    percentualHoraExtra1;
    percentualHoraExtra2;
    percentualHoraExtraDomingoFeriado;
    percentualAdicionalNoturno;
    duracaoMinutoNoturnoMin;
    bancoHorasAtivo;
    bancoHorasPrazoExpiracaoMeses;
    bancoHorasLimiteAlertaMin;
    primeiroPeriodoDescansoMinimoMin;
    intervaloRefeicaoMinimoMin;
    percentualHoraEspera;
    percentualHoraEsperaRefeicao;
    ativo;
}
exports.UpdateRegraSindicalDto = UpdateRegraSindicalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 200),
    __metadata("design:type", String)
], UpdateRegraSindicalDto.prototype, "nome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CategoriaTransporteSindical),
    __metadata("design:type", String)
], UpdateRegraSindicalDto.prototype, "categoriaTransporte", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(120),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "toleranciaMarcacaoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "limiteJornadaNormalMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "limiteHoraExtraFaixa1Min", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "percentualHoraExtra1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "percentualHoraExtra2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "percentualHoraExtraDomingoFeriado", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "percentualAdicionalNoturno", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(60),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "duracaoMinutoNoturnoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateRegraSindicalDto.prototype, "bancoHorasAtivo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "bancoHorasPrazoExpiracaoMeses", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "bancoHorasLimiteAlertaMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "primeiroPeriodoDescansoMinimoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "intervaloRefeicaoMinimoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "percentualHoraEspera", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UpdateRegraSindicalDto.prototype, "percentualHoraEsperaRefeicao", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateRegraSindicalDto.prototype, "ativo", void 0);
//# sourceMappingURL=update-regra-sindical.dto.js.map