import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { SuperAdminAutenticado } from '../decorators/current-user.decorator';

/**
 * Restringe um endpoint ao super admin da plataforma (Rodada 31) , o
 * dono da FVF Hórus, não um usuário de um Grupo. Diferente do
 * `RolesGuard` (que confere `user.papel` contra `@Roles(...)`), aqui o
 * discriminador é `user.tipo === 'SUPER_ADMIN'`: um token de
 * UsuarioEmpresa nunca tem esse campo, então nunca passa por aqui ,
 * e um token de super admin nunca tem `papel`, então nunca passa pelo
 * `RolesGuard` dos endpoints de Grupo. Os dois tipos de ator são
 * mutuamente exclusivos por construção do payload do JWT (ver
 * `SuperAdminAuthService`/`AuthService`), não por uma checagem a mais.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as SuperAdminAutenticado | undefined;
    if (!user || user.tipo !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Acesso restrito ao super admin da plataforma',
      );
    }
    return true;
  }
}
