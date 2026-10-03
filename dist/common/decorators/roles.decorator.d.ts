import { PapelUsuario } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...papeis: PapelUsuario[]) => import("@nestjs/common", { with: { "resolution-mode": "import" } }).CustomDecorator<string>;
