import { SetMetadata } from '@nestjs/common';

export const PERMITIR_SEM_CIENCIA_KEY = 'permitirSemCienciaPrivacidade';

/**
 * Rodada 208 (LGPD): por padrão TODA rota do app do motorista exige que ele
 * tenha dado ciência da versão vigente da política/termos. Esta marca
 * libera exceções: conferir o vínculo (meu-perfil) e as próprias rotas de
 * privacidade (ler documentos, dar ciência, exercer direitos do titular).
 */
export const PermitirSemCiencia = () =>
  SetMetadata(PERMITIR_SEM_CIENCIA_KEY, true);
