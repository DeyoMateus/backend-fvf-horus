import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  StatusSolicitacaoTitular,
  TipoDocumentoPrivacidade,
  TipoSolicitacaoTitular,
} from '@prisma/client';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class RegistrarAceiteDto {
  @IsEnum(TipoDocumentoPrivacidade)
  tipoDocumento!: TipoDocumentoPrivacidade;

  @IsString()
  @Length(1, 30)
  versao!: string;
}

export class CriarSolicitacaoTitularDto {
  @IsEnum(TipoSolicitacaoTitular)
  tipo!: TipoSolicitacaoTitular;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 1000)
  descricao?: string;
}

export class ResponderSolicitacaoTitularDto {
  @IsEnum(StatusSolicitacaoTitular)
  status!: StatusSolicitacaoTitular;

  @Sanitizar()
  @IsString()
  @Length(0, 2000)
  resposta!: string;
}

/** Todos os campos são opcionais: deixar tudo em branco remove o encarregado (a empresa pode não ter uma pessoa só para isso). */
export class AtualizarEncarregadoDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 120)
  nome?: string;

  @ValidateIf((o: AtualizarEncarregadoDto) => !!o.email)
  @IsEmail()
  @Length(5, 160)
  email?: string;

  @ValidateIf((o: AtualizarEncarregadoDto) => !!o.telefone)
  @Matches(/^\+\d{10,15}$/, { message: 'telefone deve estar em formato E.164' })
  telefone?: string;
}
