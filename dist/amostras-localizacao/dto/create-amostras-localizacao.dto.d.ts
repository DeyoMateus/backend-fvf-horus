export declare class AmostraLocalizacaoItemDto {
    latitude: number;
    longitude: number;
    precisaoGpsM?: number;
    capturadoEm: string;
}
export declare class CreateAmostrasLocalizacaoDto {
    amostras: AmostraLocalizacaoItemDto[];
}
