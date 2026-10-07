import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActorType } from '@prisma/client';

export class ListarAuditoriaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsEnum(ActorType)
  actorType?: ActorType;

  /**
   * "Selecionando os ocorridos" (pedido do usuário) , o painel visual
   * deixa marcar várias ações de uma vez (ex.: MOTORISTA_EXCLUIDO +
   * MOTORISTA_STATUS_ALTERADO), não só uma.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  acoes?: string[];

  @IsOptional()
  @IsString()
  @Length(0, 100)
  entidade?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  entidadeId?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  /**
   * Rodada 108 , pedido do usuário: ordenar do mais recente pro mais
   * antigo, ou o inverso, em toda tabela de listagem do painel. Aqui é
   * paginação de servidor, então o toggle também precisa ir pro
   * servidor (não dá pra só reordenar a página já trazida , isso
   * baguncaria a paginação). Default (sem informar) continua
   * 'desc' (mais recente primeiro), igual já era antes desta rodada.
   */
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  ordem?: 'asc' | 'desc';

  /**
   * Só é lido pela versão SUPER_ADMIN do painel (`SuperAdminController`)
   * , a versão ADMIN/GESTOR (`AuditoriaController`) SEMPRE ignora este
   * campo mesmo que venha na query, usando `user.grupoId` do token.
   */
  @IsOptional()
  @IsUUID()
  grupoId?: string;
}
