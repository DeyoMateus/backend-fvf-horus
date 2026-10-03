import { Module } from '@nestjs/common';
import { HoleriteModule } from '../holerite/holerite.module';
import { BancoHorasController } from './banco-horas.controller';
import { BancoHorasService } from './banco-horas.service';

@Module({
  imports: [HoleriteModule],
  controllers: [BancoHorasController],
  providers: [BancoHorasService],
  exports: [BancoHorasService],
})
export class BancoHorasModule {}
