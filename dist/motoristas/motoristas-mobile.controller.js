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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoristasMobileController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const banco_horas_service_1 = require("../banco-horas/banco-horas.service");
const holerite_service_1 = require("../holerite/holerite.service");
const atualizar_perfil_motorista_dto_1 = require("./dto/atualizar-perfil-motorista.dto");
const motoristas_service_1 = require("./motoristas.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
function inicioDoMes(agora) {
    const p = (0, fuso_brasil_util_1.paraParedeBrt)(agora);
    return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 1, 0, 0, 0));
}
function resolverInicioMesSolicitado(agora, anoQuery, mesQuery) {
    const inicioMesAtual = inicioDoMes(agora);
    if (!anoQuery && !mesQuery)
        return inicioMesAtual;
    const agoraBrt = (0, fuso_brasil_util_1.paraParedeBrt)(agora);
    const ano = anoQuery ? Number(anoQuery) : agoraBrt.getUTCFullYear();
    const mes = mesQuery ? Number(mesQuery) : agoraBrt.getUTCMonth() + 1;
    if (!Number.isFinite(ano) ||
        !Number.isFinite(mes) ||
        mes < 1 ||
        mes > 12) {
        return inicioMesAtual;
    }
    const inicioSolicitado = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
    return inicioSolicitado.getTime() > inicioMesAtual.getTime()
        ? inicioMesAtual
        : inicioSolicitado;
}
function fimDoMes(inicioMes) {
    return new Date(Date.UTC(inicioMes.getUTCFullYear(), inicioMes.getUTCMonth() + 1, 0, 0, 0, 0));
}
let MotoristasMobileController = class MotoristasMobileController {
    motoristasService;
    holerite;
    bancoHoras;
    constructor(motoristasService, holerite, bancoHoras) {
        this.motoristasService = motoristasService;
        this.holerite = holerite;
        this.bancoHoras = bancoHoras;
    }
    obterMeuPerfil(req) {
        return this.motoristasService.obterPerfilProprio(req.motorista.id);
    }
    atualizarMeuPerfil(req, dto) {
        return this.motoristasService.atualizarPerfilProprio(req.motorista.id, dto);
    }
    async minhasHoras(req, anoQuery, mesQuery) {
        const agora = new Date();
        const inicioMesAtual = inicioDoMes(agora);
        const inicioMes = resolverInicioMesSolicitado(agora, anoQuery, mesQuery);
        const ehMesAtual = inicioMes.getTime() === inicioMesAtual.getTime();
        const fimPeriodo = ehMesAtual ? agora : fimDoMes(inicioMes);
        const [mes, bancoHorasAtivo] = await Promise.all([
            this.holerite.calcular(req.motorista.id, inicioMes, fimPeriodo, { direcaoEspera: true, normalExtra: true, adicionalNoturno: true }, req.grupoId),
            this.bancoHoras.estaAtivoParaMotorista(req.motorista.id),
        ]);
        let bancoHoras = null;
        if (bancoHorasAtivo) {
            const [saldoMes, saldoTotal] = await Promise.all([
                this.bancoHoras.calcularSaldo(req.motorista.id, inicioMes, fimPeriodo, req.grupoId),
                this.bancoHoras.calcularSaldo(req.motorista.id, req.motorista.createdAt, agora, req.grupoId),
            ]);
            bancoHoras = {
                ativo: true,
                saldoMesMin: saldoMes.saldoMin,
                saldoTotalMin: saldoTotal.saldoMin,
            };
        }
        return {
            periodoInicio: inicioMes,
            periodoFim: fimPeriodo,
            ehMesAtual,
            horasMes: mes.totais,
            bancoHoras,
        };
    }
};
exports.MotoristasMobileController = MotoristasMobileController;
__decorate([
    (0, common_1.Get)('meu-perfil'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MotoristasMobileController.prototype, "obterMeuPerfil", null);
__decorate([
    (0, common_1.Patch)('meu-perfil'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, atualizar_perfil_motorista_dto_1.AtualizarPerfilMotoristaDto]),
    __metadata("design:returntype", void 0)
], MotoristasMobileController.prototype, "atualizarMeuPerfil", null);
__decorate([
    (0, common_1.Get)('minhas-horas'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('ano')),
    __param(2, (0, common_1.Query)('mes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], MotoristasMobileController.prototype, "minhasHoras", null);
exports.MotoristasMobileController = MotoristasMobileController = __decorate([
    (0, common_1.Controller)('dispositivo'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [motoristas_service_1.MotoristasService,
        holerite_service_1.HoleriteService,
        banco_horas_service_1.BancoHorasService])
], MotoristasMobileController);
//# sourceMappingURL=motoristas-mobile.controller.js.map