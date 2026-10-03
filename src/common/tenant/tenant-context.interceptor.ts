import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';

/**
 * Interceptor global (ver app.module.ts) que estabelece, pra TODA
 * requisição HTTP, qual grupo (tenant) o `PrismaService` deve usar nas
 * operações protegidas por Row-Level Security (ver
 * common/prisma/prisma.service.ts e a migration `..._row_level_security`).
 *
 * `request.user.grupoId` vem do JWT (JwtAuthGuard/JwtStrategy , painel
 * web). `request.grupoId` vem do MotoristaDeviceGuard (app mobile,
 * autenticado por device binding, não por JWT). Quando nenhum dos dois
 * está presente , rotas públicas, como login ou a solicitação de troca
 * de aparelho, que ainda não sabem a qual grupo o usuário/motorista
 * pertence , a requisição roda como SISTEMA (sem restrição de tenant),
 * exatamente como já era antes de existir RLS: essas rotas nunca
 * dependeram de filtro por grupo pra sua própria segurança, usam suas
 * próprias checagens (ex.: CPF de confirmação, comparação em tempo
 * constante , ver Rodada 6).
 *
 * Roda DEPOIS dos guards (JwtAuthGuard/MotoristaDeviceGuard já
 * populam `request.user`/`request.grupoId` antes de qualquer
 * interceptor executar), então o valor já está disponível aqui.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const grupoId: string | undefined =
      request.user?.grupoId ?? request.grupoId ?? undefined;

    return new Observable((subscriber) => {
      const executar = () => next.handle().subscribe(subscriber);
      if (grupoId) {
        TenantContext.paraGrupo(grupoId, executar);
      } else {
        TenantContext.paraSistema(executar);
      }
    });
  }
}
