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
exports.TratarDiaSemInteracaoDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class TratarDiaSemInteracaoDto {
    data;
    tipo;
    observacao;
}
exports.TratarDiaSemInteracaoDto = TratarDiaSemInteracaoDto;
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], TratarDiaSemInteracaoDto.prototype, "data", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TipoTratamentoDiaSemInteracao),
    __metadata("design:type", String)
], TratarDiaSemInteracaoDto.prototype, "tipo", void 0);
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 400),
    __metadata("design:type", String)
], TratarDiaSemInteracaoDto.prototype, "observacao", void 0);
//# sourceMappingURL=tratar-dia-sem-interacao.dto.js.map