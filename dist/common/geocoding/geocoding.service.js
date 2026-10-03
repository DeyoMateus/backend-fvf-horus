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
var GeocodingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeocodingService = void 0;
const common_1 = require("@nestjs/common");
let GeocodingService = GeocodingService_1 = class GeocodingService {
    logger = new common_1.Logger(GeocodingService_1.name);
    ativado;
    baseUrl;
    userAgent;
    timeoutMs;
    constructor() {
        this.ativado = process.env.GEOCODING_DESATIVADO !== 'true';
        this.baseUrl =
            process.env.GEOCODING_API_URL ??
                'https://nominatim.openstreetmap.org/search';
        this.userAgent =
            process.env.GEOCODING_USER_AGENT ?? 'FVF-Horus-ControleJornada/1.0';
        this.timeoutMs = Number(process.env.GEOCODING_TIMEOUT_MS ?? 5000);
    }
    configurado() {
        return this.ativado;
    }
    async geocodificar(endereco) {
        if (!this.ativado || !endereco?.trim())
            return null;
        const controle = new AbortController();
        const timer = setTimeout(() => controle.abort(), this.timeoutMs);
        try {
            const url = new URL(this.baseUrl);
            url.searchParams.set('q', endereco);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '1');
            url.searchParams.set('countrycodes', 'br');
            const resposta = await fetch(url.toString(), {
                headers: { 'User-Agent': this.userAgent },
                signal: controle.signal,
            });
            if (!resposta.ok) {
                this.logger.warn(`Geocodificação retornou HTTP ${resposta.status} para "${endereco}"`);
                return null;
            }
            const dados = (await resposta.json());
            const primeiro = dados[0];
            if (!primeiro?.lat || !primeiro?.lon)
                return null;
            const latitude = Number(primeiro.lat);
            const longitude = Number(primeiro.lon);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
                return null;
            return { latitude, longitude };
        }
        catch (err) {
            this.logger.warn(`Falha ao geocodificar "${endereco}": ${err.message}`);
            return null;
        }
        finally {
            clearTimeout(timer);
        }
    }
};
exports.GeocodingService = GeocodingService;
exports.GeocodingService = GeocodingService = GeocodingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GeocodingService);
//# sourceMappingURL=geocoding.service.js.map