export interface CoordenadasGeocodificadas {
    latitude: number;
    longitude: number;
}
export declare class GeocodingService {
    private readonly logger;
    private readonly ativado;
    private readonly baseUrl;
    private readonly userAgent;
    private readonly timeoutMs;
    constructor();
    configurado(): boolean;
    geocodificar(endereco: string | null | undefined): Promise<CoordenadasGeocodificadas | null>;
}
