"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const cloudflare_middleware_1 = require("./common/cloudflare/cloudflare.middleware");
const verificacao_producao_util_1 = require("./common/config/verificacao-producao.util");
async function bootstrap() {
    const { erros, avisos } = (0, verificacao_producao_util_1.verificarConfiguracaoDeProducao)(process.env);
    for (const aviso of avisos)
        console.warn(`[config] AVISO: ${aviso}`);
    if (erros.length > 0) {
        for (const erro of erros)
            console.error(`[config] ERRO: ${erro}`);
        throw new Error('Configuração de produção inválida; veja os erros acima.');
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: new common_1.ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
    });
    const cloudflare = (0, cloudflare_middleware_1.criarMiddlewareCloudflare)(process.env);
    if (cloudflare)
        app.use(cloudflare);
    app.use((0, cloudflare_middleware_1.semCacheNaApi)());
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    const origensPermitidas = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .filter(Boolean);
    app.enableCors({
        origin: origensPermitidas.length > 0 ? origensPermitidas : false,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'x-fvf-horus-client',
            'x-fuso-offset-min',
        ],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const saltosProxy = Number(process.env.TRUST_PROXY_HOPS ?? 1);
    app
        .getHttpAdapter()
        .getInstance()
        .set('trust proxy', Number.isInteger(saltosProxy) && saltosProxy >= 0 ? saltosProxy : 1);
    app.getHttpAdapter().getInstance().set('query parser', 'extended');
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
//# sourceMappingURL=main.js.map