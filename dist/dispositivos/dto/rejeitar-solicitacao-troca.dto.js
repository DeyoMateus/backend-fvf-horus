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
exports.RejeitarSolicitacaoTrocaDto = void 0;
const class_validator_1 = require("class-validator");
const sanitizar_decorator_1 = require("../../common/sanitizacao/sanitizar.decorator");
class RejeitarSolicitacaoTrocaDto {
    motivo;
}
exports.RejeitarSolicitacaoTrocaDto = RejeitarSolicitacaoTrocaDto;
__decorate([
    (0, sanitizar_decorator_1.Sanitizar)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10, {
        message: 'Motivo da rejeição precisa de pelo menos 10 caracteres.',
    }),
    (0, class_validator_1.Length)(0, 400),
    __metadata("design:type", String)
], RejeitarSolicitacaoTrocaDto.prototype, "motivo", void 0);
//# sourceMappingURL=rejeitar-solicitacao-troca.dto.js.map