"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grupoIdSeguro = grupoIdSeguro;
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function grupoIdSeguro(grupoId) {
    if (grupoId === '__sistema__' || UUID_REGEX.test(grupoId))
        return grupoId;
    throw new Error('grupoId inválido para o contexto de RLS.');
}
//# sourceMappingURL=grupo-id-seguro.js.map