import { Module } from '@nestjs/common';
import { AlertasJornadaController } from './alertas-jornada.controller';
import { AlertasJornadaMobileController } from './alertas-jornada-mobile.controller';
import { AlertasJornadaService } from './alertas-jornada.service';

@Module({
  controllers: [AlertasJornadaController, AlertasJornadaMobileController],
  providers: [AlertasJornadaService],
  exports: [AlertasJornadaService],
})
export class AlertasJornadaModule {}
