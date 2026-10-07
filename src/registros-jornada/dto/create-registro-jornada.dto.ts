import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';
import { TipoEvento } from '@prisma/client';

export class CreateRegistroJornadaDto {
  @IsEnum(TipoEvento)
  tipoEvento!: TipoEvento;

  @IsISO8601()
  timestampEvento!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  precisaoGpsM?: number;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 400)
  observacao?: string;

  /**
   * Gerada pelo app no momento em que o evento acontece (mesmo offline).
   * Garante que reenviar o mesmo evento depois de reconectar não cria
   * um registro duplicado na cadeia (idempotência do sync offline-first).
   */
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  /**
   * Sinais de comprometimento do aparelho detectados pelo próprio app
   * (root/jailbreak, hooking, "mock location" habilitado) no momento em
   * que o evento foi batido , ver `mobile/src/security/deviceIntegrity.ts`.
   * Nunca bloqueia a criação do registro em si (o ponto sempre é
   * aceito, pra não travar o motorista em campo); só entra no
   * AuditLog para o gestor investigar depois.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  flagsIntegridadeDispositivo?: string[];

  /**
   * Rodada 88 , relógio monotônico do aparelho no momento do toque
   * (Android `SystemClock.elapsedRealtime()` / iOS
   * `ProcessInfo.systemUptime`, em ms), capturado pelo módulo nativo
   * (só existe numa build própria/EAS , no Expo Go vem `undefined`).
   * Usado por `RegistrosJornadaService.create` pra detectar relógio de
   * parede manualmente alterado entre dois toques do MESMO aparelho,
   * mesmo offline , ver comentário em schema.prisma no campo
   * equivalente do RegistroJornada.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  elapsedRealtimeMs?: number;

  /**
   * Rodada 146 , deslocamento de fuso do aparelho no momento do toque
   * (minutos a leste do UTC, ex.: -240 em Cuiabá), gravado pelo app no
   * toque (funciona offline). Opcional: app antigo não envia. Aceita uma
   * faixa ampla de propósito , um valor fora do que o Brasil usa NÃO
   * rejeita o ponto (nunca travar o motorista nem derrubar um lote
   * inteiro); `resolverFusoDoRegistro` simplesmente o descarta.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-720)
  @Max(840)
  fusoOffsetMin?: number;
}
