import { IsISO8601 } from 'class-validator';

export class SaldoBancoHorasQueryDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;
}
