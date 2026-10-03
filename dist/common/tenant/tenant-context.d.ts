export declare const SISTEMA = "__sistema__";
interface ContextoTenant {
    grupoId: string;
}
export declare const TenantContext: {
    paraGrupo<T>(grupoId: string, fn: () => T): T;
    paraSistema<T>(fn: () => T): T;
    atual(): ContextoTenant | undefined;
};
export {};
