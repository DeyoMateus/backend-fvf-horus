import { Module } from '@nestjs/common';
import { AjudantesController } from './ajudantes.controller';
import { AjudantesService } from './ajudantes.service';

@Module({
  controllers: [AjudantesController],
  providers: [AjudantesService],
  exports: [AjudantesService],
})
export class AjudantesModule {}
