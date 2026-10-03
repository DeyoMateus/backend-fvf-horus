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
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: new common_1.ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
    });
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    const origensPermitidas = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .filter(Boolean);
    app.enableCors({
        origin: origensPermitidas.length > 0 ? origensPermitidas : false,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'x-fvf-horus-client'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.getHttpAdapter().getInstance().set('query parser', 'extended');
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
//# sourceMappingURL=main.js.map