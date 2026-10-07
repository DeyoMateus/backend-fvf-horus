import { TipoDocumentoCarga, StatusCargaViagem } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class CreateDocumentoCargaDto {
  @IsEnum(TipoDocumentoCarga)
  tipo!: TipoDocumentoCarga;

  @IsEnum(StatusCargaViagem)
  statusCarga!: StatusCargaViagem;

  @IsOptional()
  @IsUUID()
  motoristaId?: string;

  /**
   * Obrigatório quando `motoristaId` NÃO vier (documento ainda sem
   * motorista vinculado) , diz a qual CNPJ do grupo este documento
   * pertence, já que um grupo pode ter mais de um. Sempre conferido
   * contra o grupo de quem está enviando (TenantService) antes de
   * aceitar; quando `motoristaId` vem, o empresaId do PRÓPRIO motorista
   * prevalece e este campo é ignorado.
   */
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  /** Se não vier, tentamos extrair do próprio XML (best-effort) , ver extrair-metadados-xml.ts. */
  @IsOptional()
  @IsString()
  @Length(1, 50)
  numero?: string;

  /** Chave de acesso: 44 dígitos. Se não vier, tentamos extrair do XML. */
  @IsOptional()
  @Matches(/^\d{44}$/, {
    message: 'chaveAcesso deve ter exatamente 44 dígitos',
  })
  chaveAcesso?: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 400)
  observacao?: string;
}
