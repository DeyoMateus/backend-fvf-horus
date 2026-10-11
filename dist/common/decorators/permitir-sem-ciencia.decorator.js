"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermitirSemCiencia = exports.PERMITIR_SEM_CIENCIA_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PERMITIR_SEM_CIENCIA_KEY = 'permitirSemCienciaPrivacidade';
const PermitirSemCiencia = () => (0, common_1.SetMetadata)(exports.PERMITIR_SEM_CIENCIA_KEY, true);
exports.PermitirSemCiencia = PermitirSemCiencia;
//# sourceMappingURL=permitir-sem-ciencia.decorator.js.map