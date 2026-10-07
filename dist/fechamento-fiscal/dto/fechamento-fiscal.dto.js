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
exports.FechamentoFiscalQueryDto = void 0;
const class_validator_1 = require("class-validator");
class FechamentoFiscalQueryDto {
    inicio;
    fim;
    motoristaIds;
}
exports.FechamentoFiscalQueryDto = FechamentoFiscalQueryDto;
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], FechamentoFiscalQueryDto.prototype, "inicio", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], FechamentoFiscalQueryDto.prototype, "fim", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    (0, class_validator_1.Matches)(/^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$/, {
        message: 'motoristaIds deve ser uma lista de UUIDs separados por vírgula',
    }),
    __metadata("design:type", String)
], FechamentoFiscalQueryDto.prototype, "motoristaIds", void 0);
//# sourceMappingURL=fechamento-fiscal.dto.js.map