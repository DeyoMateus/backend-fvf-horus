import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PapelUsuario } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UsuarioAutenticado } from '../decorators/current-user.decorator';

/** RBAC: exige que o usuário autenticado tenha um dos papéis declarados em @Roles(...). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeisPermitidos = this.reflector.getAllAndOverride<PapelUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!papeisPermitidos || papeisPermitidos.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as UsuarioAutenticado | undefined;
    if (!user || !papeisPermitidos.includes(user.papel as PapelUsuario)) {
      throw new ForbiddenException('Papel do usuário não autorizado para esta operação');
    }
    return true;
  }
}
