export const FILA_NOTIFICACOES_WHATSAPP = 'notificacoes-whatsapp';

/**
 * Alertas que NÃO vão por WhatsApp para a equipe de Gerenciamento de Risco:
 * fraude/adulteração e demais sinais de integridade aparecem apenas no
 * sininho do painel. O WhatsApp fica reservado a jornada e perigo (limites
 * de direção, jornada, espera e tempo indefinido).
 */
export const TIPOS_ALERTA_SOMENTE_PAINEL: readonly string[] = [
  'OCIOSIDADE_DIRECAO_SUSPEITA',
  'VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS',
  'RELOGIO_DISPOSITIVO_SUSPEITO',
  'SEQUENCIA_JORNADA_MUITO_RAPIDA',
  'ODOMETRO_REGRESSIVO',
  'INTEGRIDADE_DISPOSITIVO_SUSPEITA',
  'INTEGRIDADE_CADEIA_VIOLADA',
  'PONTO_REGISTRADO_EM_DIA_DE_FOLGA',
  'ENTREGA_FORA_DA_CERCA_VIRTUAL',
];
