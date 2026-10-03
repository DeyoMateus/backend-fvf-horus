import { Module } from '@nestjs/common';
import { BancoHorasModule } from '../banco-horas/banco-horas.module';
import { HoleriteModule } from '../holerite/holerite.module';
import { MotoristasController } from './motoristas.controller';
import { MotoristasMobileController } from './motoristas-mobile.controller';
import { MotoristasService } from './motoristas.service';

@Module({
  imports: [HoleriteModule, BancoHorasModule],
  controllers: [MotoristasController, MotoristasMobileController],
  providers: [MotoristasService],
  exports: [MotoristasService],
})
export class MotoristasModule {}
