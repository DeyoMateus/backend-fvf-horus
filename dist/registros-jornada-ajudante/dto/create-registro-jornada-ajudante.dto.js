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
exports.CreateRegistroJornadaAjudanteDto = exports.TIPOS_EVENTO_AJUDANTE = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
const client_1 = require("@prisma/client");
exports.TIPOS_EVENTO_AJUDANTE = [
    client_1.TipoEvento.INICIO_JORNADA,
    client_1.TipoEvento.INICIO_DESCANSO,
    client_1.TipoEvento.FIM_DESCANSO,
    client_1.TipoEvento.FIM_JORNADA,
];
class CreateRegistroJornadaAjudanteDto {
    tipoEvento;
    timestampEvento;
    latitude;
    longitude;
    precisaoGpsM;
    observacao;
    idempotencyKey;
}
exports.CreateRegistroJornadaAjudanteDto = CreateRegistroJornadaAjudanteDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.TIPOS_EVENTO_AJUDANTE),
    __metadata("design:type", String)
], CreateRegistroJornadaAjudanteDto.prototype, "tipoEvento", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateRegistroJornadaAjudanteDto.prototype, "timestampEvento", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsLatitude)(),
    __metadata("design:type", Number)
], CreateRegistroJornadaAjudanteDto.prototype, "latitude", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsLongitude)(),
    __metadata("design:type", Number)
], CreateRegistroJornadaAjudanteDto.prototype, "longitude", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateRegistroJornadaAjudanteDto.prototype, "precisaoGpsM", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 500),
    __metadata("design:type", String)
], CreateRegistroJornadaAjudanteDto.prototype, "observacao", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateRegistroJornadaAjudanteDto.prototype, "idempotencyKey", void 0);
//# sourceMappingURL=create-registro-jornada-ajudante.dto.js.map