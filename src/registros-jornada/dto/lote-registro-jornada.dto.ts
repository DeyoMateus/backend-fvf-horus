import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateRegistroJornadaDto } from './create-registro-jornada.dto';

/**
 * Envio em lote (Rodada 66) , pedido do usuário: "os motoristas podem
 * ter vários registros e enviar tudo de uma vez quando estiverem com
 * acesso à internet". Cada item é validado exatamente como o envio
 * avulso (CreateRegistroJornadaDto), incluindo a idempotencyKey de
 * cada um , reenviar o mesmo lote (ex.: o app perdeu a resposta e
 * tenta de novo) não duplica nada na cadeia.
 *
 * Limite de 200 por requisição: um motorista realista acumula no
 * máximo algumas dezenas de eventos por viagem sem internet; o limite
 * existe pra manter o lote (processado sequencialmente, em ORDEM, por
 * causa da cadeia de hash , ver RegistrosJornadaService.processarLote)
 * dentro de um tempo de resposta razoável mesmo se o Redis estiver
 * fora do ar e o processamento cair no fallback síncrono.
 */
export class LoteRegistroJornadaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateRegistroJornadaDto)
  eventos!: CreateRegistroJornadaDto[];
}
