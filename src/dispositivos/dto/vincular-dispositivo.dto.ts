import { IsUUID } from 'class-validator';

export class VincularDispositivoDto {
  /** Gerado pelo próprio app na primeira instalação (identificador do aparelho). */
  @IsUUID()
  deviceUuid!: string;
}
