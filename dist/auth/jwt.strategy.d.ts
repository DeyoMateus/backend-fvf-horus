import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(config: ConfigService);
    validate(payload: UsuarioAutenticado): UsuarioAutenticado;
}
export {};
