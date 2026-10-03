import { Transform } from 'class-transformer';

/**
 * Sanitização de texto livre vindo do usuário (Rodada 40, pedido
 * explícito: "sanitizar os inputs... não dados maliciosos").
 *
 * O `ValidationPipe` global (main.ts) já usa `whitelist +
 * forbidNonWhitelisted`, o que impede campo extra não declarado no
 * DTO, e o Prisma sempre usa queries parametrizadas (nunca SQL
 * concatenado à mão), o que já elimina injeção de SQL. O que faltava
 * era limpar o CONTEÚDO de campos de texto livre (nome, observação,
 * justificativa, descrição...) antes de gravar: qualquer um desses
 * valores pode reaparecer em outra tela (painel do gestor, PDF de
 * holerite, notificação) sem escapar manualmente , o React já escapa
 * JSX por padrão, então isto não é a única barreira contra XSS, mas é
 * a que impede a marcação maliciosa de sequer chegar a existir no
 * banco, além de arrumar caracteres de controle invisíveis e espaços
 * redundantes que não servem a nada legítimo num nome/observação.
 *
 * Aplicado ANTES de qualquer `@IsString()`/`@Length()` no mesmo campo
 * , o valor chega ao validador já limpo, então os limites de tamanho
 * (`@Length`, `@MaxLength`) contam os caracteres finais, não os que o
 * usuário digitou antes da sanitização.
 */
export function Sanitizar() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value
      .replace(/<[^>]*>/g, '') // remove tags HTML/script inteiras (ex.: <script>...</script>, <img onerror=...>)
      .replace(/[\u0000-\u001F\u007F]/g, '') // remove caracteres de controle invisíveis (inclusive quebras de linha soltas em campos de uma linha)
      .replace(/\s+/g, ' ') // colapsa espaços/tabs/quebras de linha repetidos em um único espaço
      .trim();
  });
}

/**
 * Mantém só dígitos , usado em CPF/CNPJ/CNH, pra aceitar o usuário
 * digitando (ou colando) com a pontuação usual (123.456.789-00,
 * 12.345.678/0001-90) e ainda assim validar e gravar sempre no formato
 * canônico (só números), sem exigir que o front-end mande exatamente
 * "limpo".
 */
export function SomenteDigitos() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  );
}

/**
 * Telefone em formato E.164 (Rodada 41 , seletor de país com bandeira
 * no front-end/app, o usuário só digita DDD + número). Mantém o `+`
 * inicial (se vier) e todos os dígitos, removendo qualquer outra
 * pontuação (espaço, parênteses, traço) , o front-end/app sempre monta
 * e manda "+<código do país><DDD><número>" já concatenado, então isto
 * é só uma segunda camada de limpeza pro backend nunca depender só do
 * que o cliente compôs certinho.
 */
export function NormalizarTelefone() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const comMais = value.trim().startsWith('+');
    const digitos = value.replace(/\D/g, '');
    return comMais ? `+${digitos}` : digitos;
  });
}
