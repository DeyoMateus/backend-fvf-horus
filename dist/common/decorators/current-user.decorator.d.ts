export interface UsuarioAutenticado {
    sub: string;
    email: string;
    grupoId: string;
    papel: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
export interface SuperAdminAutenticado {
    sub: string;
    email: string;
    tipo: 'SUPER_ADMIN';
}
export declare const CurrentSuperAdmin: (...dataOrPipes: unknown[]) => ParameterDecorator;
