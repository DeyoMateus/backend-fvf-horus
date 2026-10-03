import { Module } from '@nestjs/common';
import { JornadaLegalService } from './jornada-legal.service';

@Module({
  providers: [JornadaLegalService],
  exports: [JornadaLegalService],
})
export class JornadaLegalModule {}
