import { Injectable, Logger } from '@nestjs/common';

export interface CoordenadasGeocodificadas {
  latitude: number;
  longitude: number;
}

/**
 * Geocodificação de endereço → lat/lng, usada pra resolver
 * automaticamente as coordenadas do destinatário de um CT-e a partir
 * do endereço extraído do XML (ver extrair-metadados-xml.ts) , base da
 * cerca virtual (geofence) da entrega.
 *
 * **Provedor padrão: Nominatim (OpenStreetMap), sem API key.**
 * Diferente do R2/WhatsApp (que exigem credencial própria do usuário e
 * ficam desligados até serem configuradas), a geocodificação usa por
 * padrão o serviço público e gratuito do Nominatim , não depende de o
 * usuário conseguir/configurar nenhuma credencial pra a cerca virtual
 * já funcionar. `GEOCODING_API_URL` permite apontar pra outro serviço
 * compatível (ex.: uma instância própria do Nominatim, se o volume de
 * uploads crescer e o rate-limit público de 1 req/s incomodar), e
 * `GEOCODING_DESATIVADO=true` desliga o recurso inteiro (ex.: ambiente
 * de teste sem rede externa) , nesse caso `configurado()` volta
 * `false` e o resto do app continua funcionando normalmente, sem
 * coordenadas de destinatário (mesmo padrão fail-open de toda
 * integração externa deste projeto).
 *
 * Usa só `fetch` nativo (Node 18+) , nenhuma dependência nova.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly ativado: boolean;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor() {
    this.ativado = process.env.GEOCODING_DESATIVADO !== 'true';
    this.baseUrl =
      process.env.GEOCODING_API_URL ??
      'https://nominatim.openstreetmap.org/search';
    // Nominatim exige um User-Agent identificável (não pode ser o
    // default do fetch) , ver política de uso do serviço.
    this.userAgent =
      process.env.GEOCODING_USER_AGENT ?? 'FVF-Horus-ControleJornada/1.0';
    this.timeoutMs = Number(process.env.GEOCODING_TIMEOUT_MS ?? 5000);
  }

  /** Se `false`, quem chama deve seguir sem coordenadas (fail-open). */
  configurado(): boolean {
    return this.ativado;
  }

  /**
   * Resolve um endereço em texto livre pra coordenadas. Nunca lança ,
   * qualquer falha (rede, timeout, resposta inesperada, endereço não
   * encontrado) volta `null` e fica só um log de aviso; quem chama
   * decide o fallback (aqui, sempre: documento fica sem coordenadas,
   * cerca virtual não é avaliada pra ele).
   */
  async geocodificar(
    endereco: string | null | undefined,
  ): Promise<CoordenadasGeocodificadas | null> {
    if (!this.ativado || !endereco?.trim()) return null;

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
        this.logger.warn(
          `Geocodificação retornou HTTP ${resposta.status} para "${endereco}"`,
        );
        return null;
      }

      const dados = (await resposta.json()) as Array<{
        lat?: string;
        lon?: string;
      }>;
      const primeiro = dados[0];
      if (!primeiro?.lat || !primeiro?.lon) return null;

      const latitude = Number(primeiro.lat);
      const longitude = Number(primeiro.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        return null;

      return { latitude, longitude };
    } catch (err) {
      this.logger.warn(
        `Falha ao geocodificar "${endereco}": ${(err as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
