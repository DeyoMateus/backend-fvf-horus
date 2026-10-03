import { Module } from '@nestjs/common';
import { BancoHorasModule } from '../banco-horas/banco-horas.module';
import { HoleriteModule } from '../holerite/holerite.module';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresService } from './indicadores.service';

@Module({
  imports: [HoleriteModule, BancoHorasModule],
  controllers: [IndicadoresController],
  providers: [IndicadoresService],
})
export class IndicadoresModule {}
