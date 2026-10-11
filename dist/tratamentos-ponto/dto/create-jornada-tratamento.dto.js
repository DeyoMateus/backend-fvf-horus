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
exports.CreateJornadaTratamentoDto = exports.EventoJornadaTratamentoDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class EventoJornadaTratamentoDto {
    tipoEvento;
    timestampEvento;
}
exports.EventoJornadaTratamentoDto = EventoJornadaTratamentoDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TipoEvento),
    __metadata("design:type", String)
], EventoJornadaTratamentoDto.prototype, "tipoEvento", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], EventoJornadaTratamentoDto.prototype, "timestampEvento", void 0);
class CreateJornadaTratamentoDto {
    eventos;
    motivo;
    fusoOffsetMin;
}
exports.CreateJornadaTratamentoDto = CreateJornadaTratamentoDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ArrayMaxSize)(40),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EventoJornadaTratamentoDto),
    __metadata("design:type", Array)
], CreateJornadaTratamentoDto.prototype, "eventos", void 0);
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 400),
    __metadata("design:type", String)
], CreateJornadaTratamentoDto.prototype, "motivo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(-720),
    (0, class_validator_1.Max)(840),
    __metadata("design:type", Number)
], CreateJornadaTratamentoDto.prototype, "fusoOffsetMin", void 0);
//# sourceMappingURL=create-jornada-tratamento.dto.js.map