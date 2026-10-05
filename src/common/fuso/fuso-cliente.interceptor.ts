import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { executarComFusoDoCliente } from './fuso-contexto';
import { PrismaService } from '../prisma/prisma.service';
import { offsetValido } from './fuso-brasil.util';

/**
 * Rodada 148: o painel manda o fuso do computador do gestor em cada
 * requisição (`x-fuso-offset-min`, minutos a leste do UTC). Guardamos no
 * usuário só para escrever a hora das mensagens de WhatsApp no fuso de cada
 * destinatário. Atualiza só quando muda (cache em memória) e nunca atrasa nem
 * derruba a requisição.
 */
@Injectable()
export class FusoClienteInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FusoClienteInterceptor.name);
  private readonly ultimoPorUsuario = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    let offsetDaRequisicao: number | null = null;
    try {
      const req = context.switchToHttp().getRequest();
      const usuarioId: string | undefined =
        req.user?.grupoId && req.user?.sub ? req.user.sub : undefined;
      const bruto = req.headers?.['x-fuso-offset-min'];
      const offset = typeof bruto === 'string' ? Number(bruto) : NaN;
      if (offsetValido(offset)) offsetDaRequisicao = offset;
      if (
        usuarioId &&
        offsetValido(offset) &&
        this.ultimoPorUsuario.get(usuarioId) !== offset
      ) {
        this.ultimoPorUsuario.set(usuarioId, offset);
        void this.prisma.usuarioEmpresa
          .updateMany({
            where: { id: usuarioId, NOT: { fusoOffsetMin: offset } },
            data: { fusoOffsetMin: offset },
          })
          .catch((err: unknown) =>
            this.logger.warn(`Não salvou fuso do usuário: ${String(err)}`),
          );
      }
    } catch {
      // nunca interfere na requisição
    }
    if (offsetDaRequisicao === null) return next.handle();
    const off = offsetDaRequisicao;
    return new Observable((subscriber) => {
      executarComFusoDoCliente(off, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
