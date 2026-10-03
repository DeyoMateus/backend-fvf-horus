import { Module } from '@nestjs/common';
import { FechamentoHoleriteController } from './fechamento-holerite.controller';
import { HoleriteController } from './holerite.controller';
import { HoleriteService } from './holerite.service';

@Module({
  controllers: [HoleriteController, FechamentoHoleriteController],
  providers: [HoleriteService],
  exports: [HoleriteService],
})
export class HoleriteModule {}
