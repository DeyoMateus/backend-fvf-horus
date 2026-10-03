import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

// Mesmo padrão do GerarHoleriteQueryDto (querystring, GET, pra poder
// abrir o export em CSV direto do navegador com um link). `motoristaId`
// opcional: ausente = "todos os motoristas" (visão agregada da
// operação inteira); presente = drill-down num motorista específico.
// O filtro de "indicador" (horas/extras/noturno/alertas) NÃO é
// server-side , o backend sempre calcula e devolve todos os
// indicadores juntos (o cálculo já percorre o mesmo período de dados
// pra todos eles), e o painel do gestor decide o que exibir/esconder
// na tela, sem precisar de outra ida ao servidor pra trocar de
// indicador.
export class IndicadoresQueryDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  @IsOptional()
  @IsUUID()
  motoristaId?: string;
}
