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
exports.AfdService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const nsr_service_1 = require("../nsr/nsr.service");
let AfdService = class AfdService {
    prisma;
    nsr;
    constructor(prisma, nsr) {
        this.prisma = prisma;
        this.nsr = nsr;
    }
    async gerarArquivo(empresaId, inicio, fim) {
        const empresa = await this.prisma.empresa.findUniqueOrThrow({
            where: { id: empresaId },
        });
        if (!empresa.registroInpiAfd) {
            throw new common_1.BadRequestException('Esta empresa ainda não tem o número de registro do software no INPI cadastrado ' +
                '(Empresa.registroInpiAfd). Isso é exigido pela Portaria 671/2021 pra compor o nome ' +
                'do arquivo AFD do REP-P. Cadastre o número antes de exportar.');
        }
        const motoristas = await this.prisma.motorista.findMany({
            where: { empresaId },
        });
        const registros = await this.prisma.registroJornada.findMany({
            where: {
                motorista: { empresaId },
                timestampEvento: { gte: inicio, lte: fim },
            },
            orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
        });
        const linhasTipo5 = [];
        for (const motorista of motoristas) {
            linhasTipo5.push(await this.linhaTipo5Inclusao(motorista));
        }
        const linhasTipo7 = [];
        const motoristaPorId = new Map(motoristas.map((m) => [m.id, m]));
        for (const registro of registros) {
            const motorista = motoristaPorId.get(registro.motoristaId);
            if (!motorista)
                continue;
            linhasTipo7.push(await this.linhaTipo7Marcacao(motorista, registro));
        }
        const linhaCabecalho = this.linhaTipo1(empresa, inicio, fim, registros);
        const linhaTrailer = this.linhaTipo9({
            qtdTipo2: 0,
            qtdTipo3: 0,
            qtdTipo4: 0,
            qtdTipo5: linhasTipo5.length,
            qtdTipo6: 0,
            qtdTipo7: linhasTipo7.length,
        });
        const linhas = [
            linhaCabecalho,
            ...linhasTipo5,
            ...linhasTipo7,
            linhaTrailer,
        ];
        const conteudo = linhas.join('\r\n') + '\r\n';
        const cnpjDigitos = empresa.cnpj.replace(/\D/g, '');
        const nomeArquivo = `AFD${empresa.registroInpiAfd}${cnpjDigitos}REP_P.txt`;
        return { nomeArquivo, conteudo };
    }
    linhaTipo1(empresa, inicio, fim, registros) {
        const cnpjDigitos = empresa.cnpj.replace(/\D/g, '');
        const dataInicial = registros[0]?.timestampEvento ?? inicio;
        const dataFinal = registros[registros.length - 1]?.timestampEvento ?? fim;
        const semCrc = this.padN('0', 9) +
            this.padN('1', 1) +
            this.padN('1', 1) +
            this.padA(cnpjDigitos, 14) +
            this.padN('', 14) +
            this.padA(empresa.razaoSocial, 150) +
            this.padN(empresa.registroInpiAfd ?? '', 17) +
            this.fmtData(dataInicial) +
            this.fmtData(dataFinal) +
            this.fmtDataHora(new Date()) +
            this.padN('4', 3) +
            this.padN('2', 1) +
            this.padA(cnpjDigitos, 14) +
            this.padA('FVF HORUS', 30);
        return semCrc + this.crc16Hex(semCrc);
    }
    async linhaTipo5Inclusao(motorista) {
        const nsr = await this.nsr.obterOuCriar(`motorista-inclusao:${motorista.id}`, 5);
        const cpfDigitos = motorista.cpf.replace(/\D/g, '');
        const semCrc = this.padN(String(nsr), 9) +
            this.padN('5', 1) +
            this.fmtDataHora(motorista.createdAt) +
            this.padA('I', 1) +
            this.padN(cpfDigitos, 12) +
            this.padA(motorista.nome, 52) +
            this.padA('', 4) +
            this.padN(cpfDigitos, 11);
        return semCrc + this.crc16Hex(semCrc);
    }
    async linhaTipo7Marcacao(motorista, registro) {
        const nsr = await this.nsr.obterOuCriar(`registro:${registro.id}`, 7);
        const cpfDigitos = motorista.cpf.replace(/\D/g, '');
        const hashSha256 = (0, crypto_1.createHash)('sha256')
            .update(registro.hashAtual)
            .digest('hex');
        const semCrc = this.padN(String(nsr), 9) +
            this.padN('7', 1) +
            this.fmtDataHora(registro.timestampEvento) +
            this.padN(cpfDigitos, 12) +
            this.fmtDataHora(registro.createdAt) +
            this.padN('1', 2) +
            this.padN('0', 1) +
            this.padA(hashSha256, 64);
        return semCrc + this.crc16Hex(semCrc);
    }
    linhaTipo9(contadores) {
        const corpo = this.padN('9', 9) +
            this.padN(String(contadores.qtdTipo2), 9) +
            this.padN(String(contadores.qtdTipo3), 9) +
            this.padN(String(contadores.qtdTipo4), 9) +
            this.padN(String(contadores.qtdTipo5), 9) +
            this.padN(String(contadores.qtdTipo6), 9) +
            this.padN(String(contadores.qtdTipo7), 9) +
            this.padN('9', 1);
        const assinatura = this.padA('', 100);
        return corpo + assinatura;
    }
    padN(valor, tamanho) {
        const digitos = valor.replace(/\D/g, '');
        return digitos.slice(-tamanho).padStart(tamanho, '0');
    }
    padA(valor, tamanho) {
        return valor.slice(0, tamanho).padEnd(tamanho, ' ');
    }
    fmtData(data) {
        return data.toISOString().slice(0, 10);
    }
    fmtDataHora(data) {
        const iso = data.toISOString();
        const dataHoraUtc = new Date(iso);
        const offsetMs = -3 * 60 * 60 * 1000;
        const local = new Date(dataHoraUtc.getTime() + offsetMs);
        const pad2 = (n) => String(n).padStart(2, '0');
        const dataParte = `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
        const horaParte = `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}:00`;
        return `${dataParte}T${horaParte}-0300`;
    }
    crc16Hex(texto) {
        let crc = 0x0000;
        const buf = Buffer.from(texto, 'latin1');
        for (const byte of buf) {
            crc ^= byte;
            for (let i = 0; i < 8; i++) {
                crc = crc & 1 ? (crc >> 1) ^ 0x8408 : crc >>> 1;
            }
        }
        return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    }
};
exports.AfdService = AfdService;
exports.AfdService = AfdService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nsr_service_1.NsrService])
], AfdService);
//# sourceMappingURL=afd.service.js.map