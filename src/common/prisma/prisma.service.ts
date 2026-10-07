import { grupoIdSeguro } from './grupo-id-seguro';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Modelos protegidos por Row-Level Security no Postgres (ver migration
 * `..._row_level_security`). Fora de propósito, intencionalmente:
 * `auditLog` (não tem um grupoId estável , actorId pode ser motorista,
 * usuário ou o próprio SISTEMA) e `afdNsr` (contador global e
 * monotônico de NSR, tem que valer pra TODOS os grupos , Portaria
 * 671/2021). Ver claude/arquitetura-seguranca-controle-jornada.md,
 * Rodada 23. `superAdminUsuario`/`superAdminRefreshToken` (Rodada 31)
 * também ficam de fora, pelo mesmo motivo: o super admin não pertence
 * a nenhum Grupo , é justamente quem PROVISIONA o primeiro Grupo de
 * cada cliente.
 */
const MODELOS_COM_RLS = [
  'grupo',
  'empresa',
  'usuarioEmpresa',
  'refreshToken',
  'motorista',
  'dispositivoVinculado',
  'veiculoVinculado',
  'amostraLocalizacao',
  'registroJornada',
  'tratamentoPonto',
  'alertaJornada',
  'solicitacaoTrocaDispositivo',
  'autorrelatoFolga',
  'folgaConcedida',
  'documentoCarga',
  'tratamentoPontoEvidencia',
  'regraSindical',
  'solicitacaoAjustePonto',
  'solicitacaoAjustePontoEvidencia',
  'feriado',
  'passwordResetToken',
  'ajusteBancoHoras',
  // Rodada 66 , Ajudante (cadastro separado do Motorista, mesma
  // proteção por tenant via empresa -> grupo, ver migration ajudante).
  'ajudante',
  'dispositivoVinculadoAjudante',
  'registroJornadaAjudante',
  // Rodada 92 , relógio confiável retroativo (ver RelogioConfiavelService).
  'amostraHoraConfiavel',
  'verificacaoRelogioPendente',
] as const;

/** Métodos de delegado de modelo do Prisma que fazem uma operação de banco (leitura/escrita). */
const OPERACOES_INTERCEPTADAS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
] as const;

type Lazy<T> = () => T;

/**
 * Wrapper único do PrismaClient. Nenhum outro ponto da aplicação deve
 * instanciar PrismaClient diretamente , isso garante um único pool de
 * conexões e um ponto central para logging de queries sensíveis.
 *
 * === Row-Level Security (Rodada 23) ===
 *
 * Além do wrapper de sempre, o construtor troca:
 *  1) os delegados dos modelos protegidos (`this.motorista`,
 *     `this.registroJornada` etc.);
 *  2) os quatro métodos de query raw (`$queryRaw`, `$queryRawUnsafe`,
 *     `$executeRaw`, `$executeRawUnsafe` , usados pelo dashboard e pela
 *     varredura de segurança) ,
 * por versões que, antes de rodar a operação de verdade, abrem uma
 * mini-transação de DUAS operações que primeiro seta
 * `app.grupo_atual` (via `SET LOCAL`, lido pelas políticas de RLS no
 * Postgres) na MESMA conexão, usando o grupo do `TenantContext` ativo
 * (ver tenant-context.ts , preenchido pelo `TenantContextInterceptor`
 * em toda requisição HTTP, ou por `TenantContext.paraSistema()` nos
 * poucos jobs internos que legitimamente cruzam vários grupos). RLS no
 * Postgres vale pra QUALQUER SQL que toque a tabela, inclusive query
 * raw , por isso os quatro métodos acima também precisam passar por
 * aqui, não só os delegados de modelo.
 *
 * Isso é TRANSPARENTE pra qualquer código que já chama
 * `this.prisma.motorista.findMany()` ou `this.prisma.$queryRaw\`...\``
 * , nenhum service precisou mudar por causa disso. A ÚNICA exceção são
 * os poucos pontos que já fazem sua própria transação manual via
 * `this.prisma.$transaction(...)` (registros-jornada.service.ts,
 * motoristas.service.ts, dispositivos.service.ts): o `tx` que o Prisma
 * entrega nesses callbacks (forma `async tx => ...`) é um objeto NOVO,
 * gerado pelo próprio Prisma, com delegados ORIGINAIS (não passa pela
 * interceptação acima) , por isso cada um desses três pontos faz o
 * `SET LOCAL` à mão, uma vez, logo no início do bloco. Quando é a forma
 * array (`$transaction([...])`), o próprio `$transaction` NÃO é
 * interceptado (continua sendo o original do Prisma) , só os itens
 * dentro do array que vêm de `this.prisma.<modelo>.<op>()` passariam
 * pela interceptação e abririam sua PRÓPRIA mini-transação, quebrando a
 * atomicidade; por isso esses pontos usam `this.cru.<modelo>` (delegado
 * SEM RLS) pra montar os itens do array, com o `SET LOCAL` como
 * primeiro item, manual.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  readonly cru: Pick<PrismaClient, (typeof MODELOS_COM_RLS)[number]>;

  private readonly transactionOriginal: PrismaClient['$transaction'];
  private readonly executeRawUnsafeOriginal: PrismaClient['$executeRawUnsafe'];

  constructor() {
    super();

    // Capturados ANTES de qualquer override abaixo , são usados
    // INTERNAMENTE por `executarComRls` pra montar a mini-transação
    // (SET LOCAL + operação real) sem recair na própria interceptação
    // (o que causaria recursão infinita).
    this.transactionOriginal = this.$transaction.bind(this);
    this.executeRawUnsafeOriginal = this.$executeRawUnsafe.bind(this);

    const cru: Record<string, unknown> = {};

    for (const nomeModelo of MODELOS_COM_RLS) {
      const delegadoOriginal = (this as unknown as Record<string, unknown>)[
        nomeModelo
      ];
      if (!delegadoOriginal) continue;
      cru[nomeModelo] = delegadoOriginal;

      const proxy = new Proxy(delegadoOriginal as Record<string, unknown>, {
        get: (target, prop: string) => {
          const original = target[prop];
          if (
            typeof original !== 'function' ||
            !(OPERACOES_INTERCEPTADAS as readonly string[]).includes(prop)
          ) {
            return original;
          }
          return (...args: unknown[]) =>
            this.executarComRls(`${nomeModelo}.${prop}`, () =>
              (original as (...a: unknown[]) => unknown).apply(target, args),
            );
        },
      });

      Object.defineProperty(this, nomeModelo, {
        value: proxy,
        configurable: true,
        enumerable: true,
      });
    }

    this.cru = cru as Pick<PrismaClient, (typeof MODELOS_COM_RLS)[number]>;

    // Query raw: RLS no Postgres vale pra qualquer SQL, então mesmo uma
    // consulta/comando raw contra uma tabela protegida precisa do SET
    // LOCAL antes. Ver dashboard.service.ts (7 consultas raw, sempre
    // dentro de requisições autenticadas) e
    // registros-jornada.service.ts (a varredura de segurança, sempre
    // como SISTEMA).
    const rawQueryRaw = this.$queryRaw.bind(this);
    const rawQueryRawUnsafe = this.$queryRawUnsafe.bind(this);
    const rawExecuteRaw = this.$executeRaw.bind(this);
    Object.defineProperty(this, '$queryRaw', {
      value: (...args: unknown[]) =>
        this.executarComRls('$queryRaw', () => (rawQueryRaw as any)(...args)),
      configurable: true,
    });
    Object.defineProperty(this, '$queryRawUnsafe', {
      value: (...args: unknown[]) =>
        this.executarComRls('$queryRawUnsafe', () =>
          (rawQueryRawUnsafe as any)(...args),
        ),
      configurable: true,
    });
    Object.defineProperty(this, '$executeRaw', {
      value: (...args: unknown[]) =>
        this.executarComRls('$executeRaw', () =>
          (rawExecuteRaw as any)(...args),
        ),
      configurable: true,
    });
    // `$executeRawUnsafe` PERMANECE o original (não interceptado): é o
    // método que `executarComRls` e os três pontos com transação manual
    // usam pra emitir o próprio SET LOCAL , interceptá-lo também
    // causaria recursão. Qualquer código de aplicação que precisar
    // rodar um `$executeRawUnsafe` de verdade contra uma tabela
    // protegida deve fazer o SET LOCAL manualmente (mesmo padrão dos
    // três pontos citados acima) , nenhum caso assim existe hoje fora
    // deles.
  }

  /**
   * Executa `chamar()` (uma chamada Prisma AINDA NÃO aguardada ,
   * precisa continuar "lazy" pra poder entrar no array de
   * `$transaction`) dentro de uma transação de duas operações:
   * primeiro o `SET LOCAL app.grupo_atual`, depois a operação real. As
   * duas rodam na mesma conexão/transação porque `$transaction([...])`
   * (forma array) do Prisma sempre pina todos os itens numa única
   * conexão , é exatamente esse comportamento (não a forma
   * `$transaction(async tx => ...)`) que faz o `SET LOCAL` valer pra
   * operação seguinte.
   */
  private async executarComRls<T>(
    nomeOperacao: string,
    chamar: Lazy<T>,
  ): Promise<Awaited<T>> {
    const ctx = TenantContext.atual();
    if (!ctx) {
      throw new Error(
        `Acesso a "${nomeOperacao}" sem contexto de tenant definido. Toda leitura/escrita nas tabelas ` +
          'protegidas por Row-Level Security precisa rodar dentro do TenantContextInterceptor (requisição ' +
          'HTTP) ou de TenantContext.paraSistema() (job interno). Ver ' +
          'claude/arquitetura-seguranca-controle-jornada.md, Rodada 23.',
      );
    }
    const grupoEscapado = grupoIdSeguro(ctx.grupoId);
    const [, resultado] = await this.transactionOriginal([
      this.executeRawUnsafeOriginal(
        `SET LOCAL app.grupo_atual = '${grupoEscapado}'`,
      ),
      chamar() as never,
    ]);
    return resultado as Awaited<T>;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
