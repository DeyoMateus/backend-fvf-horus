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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NsrService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let NsrService = class NsrService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async obterOuCriar(chaveOrigem, tipoRegistro) {
        const existente = await this.prisma.afdNsr.findUnique({
            where: { chaveOrigem },
        });
        if (existente)
            return existente.nsr;
        const criado = await this.prisma.afdNsr.create({
            data: { chaveOrigem, tipoRegistro },
        });
        return criado.nsr;
    }
};
exports.NsrService = NsrService;
exports.NsrService = NsrService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NsrService);
//# sourceMappingURL=nsr.service.js.map