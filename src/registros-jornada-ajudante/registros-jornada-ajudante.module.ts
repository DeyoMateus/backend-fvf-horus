import { Module } from '@nestjs/common';
import { RegistrosJornadaAjudanteController } from './registros-jornada-ajudante.controller';
import { RegistrosJornadaAjudanteService } from './registros-jornada-ajudante.service';

@Module({
  controllers: [RegistrosJornadaAjudanteController],
  providers: [RegistrosJornadaAjudanteService],
  exports: [RegistrosJornadaAjudanteService],
})
export class RegistrosJornadaAjudanteModule {}
