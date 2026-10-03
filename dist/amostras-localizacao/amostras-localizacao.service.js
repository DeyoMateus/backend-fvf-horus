"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AmostrasLocalizacaoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmostrasLocalizacaoService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma/prisma.service");
let AmostrasLocalizacaoService = AmostrasLocalizacaoService_1 = class AmostrasLocalizacaoService {
    prisma;
    logger = new common_1.Logger(AmostrasLocalizacaoService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async registrarLote(motoristaId, amostras) {
        const resultado = await this.prisma.amostraLocalizacao.createMany({
            data: amostras.map((a) => ({
                motoristaId,
                latitude: a.latitude,
                longitude: a.longitude,
                precisaoGpsM: a.precisaoGpsM ?? null,
                capturadoEm: new Date(a.capturadoEm),
            })),
        });
        this.logger.log(`${resultado.count} amostra(s) de localização gravadas para motorista ${motoristaId}`);
        return { gravadas: resultado.count };
    }
};
exports.AmostrasLocalizacaoService = AmostrasLocalizacaoService;
exports.AmostrasLocalizacaoService = AmostrasLocalizacaoService = AmostrasLocalizacaoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AmostrasLocalizacaoService);
//# sourceMappingURL=amostras-localizacao.service.js.map