import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UsuarioAutenticado {
  sub: string; // usuarioId
  email: string;
  // Tenant real é o Grupo (holding), não uma Empresa/CNPJ especifica ,
  // um grupo pode ter varios CNPJs sob o mesmo login. Renomeado de
  // empresaId em 2026-09.
  grupoId: string;
  papel: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UsuarioAutenticado;
  },
);

/**
 * Payload do JWT do super admin da plataforma (Rodada 31) , deliberadamente
 * SEM `grupoId`/`papel`: ele não pertence a nenhum Grupo. A ausência de
 * `grupoId` é o que faz o `TenantContextInterceptor` rodar a requisição
 * como SISTEMA (bypass de RLS) automaticamente , ver tenant-context.ts.
 * `tipo: 'SUPER_ADMIN'` é o discriminador que o `SuperAdminGuard` confere
 * antes de liberar qualquer endpoint de `super-admin/`.
 */
export interface SuperAdminAutenticado {
  sub: string; // superAdminId
  email: string;
  tipo: 'SUPER_ADMIN';
}

export const CurrentSuperAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SuperAdminAutenticado => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as SuperAdminAutenticado;
  },
);
