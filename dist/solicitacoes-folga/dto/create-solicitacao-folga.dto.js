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
exports.CreateSolicitacaoFolgaDto = void 0;
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
const DIA = /^\d{4}-\d{2}-\d{2}$/;
class CreateSolicitacaoFolgaDto {
    dataInicio;
    dataFim;
    observacao;
}
exports.CreateSolicitacaoFolgaDto = CreateSolicitacaoFolgaDto;
__decorate([
    (0, class_validator_1.Matches)(DIA, { message: 'dataInicio deve estar no formato AAAA-MM-DD' }),
    __metadata("design:type", String)
], CreateSolicitacaoFolgaDto.prototype, "dataInicio", void 0);
__decorate([
    (0, class_validator_1.Matches)(DIA, { message: 'dataFim deve estar no formato AAAA-MM-DD' }),
    __metadata("design:type", String)
], CreateSolicitacaoFolgaDto.prototype, "dataFim", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 400),
    __metadata("design:type", String)
], CreateSolicitacaoFolgaDto.prototype, "observacao", void 0);
//# sourceMappingURL=create-solicitacao-folga.dto.js.map