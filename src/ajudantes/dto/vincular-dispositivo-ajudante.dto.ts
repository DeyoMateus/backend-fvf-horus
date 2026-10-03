import { IsUUID } from 'class-validator';

export class VincularDispositivoAjudanteDto {
  @IsUUID()
  deviceUuid!: string;
}
