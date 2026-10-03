import { Module } from '@nestjs/common';
import { VeiculosController } from './veiculos.controller';
import { VeiculosMobileController } from './veiculos-mobile.controller';
import { VeiculosService } from './veiculos.service';

@Module({
  controllers: [VeiculosController, VeiculosMobileController],
  providers: [VeiculosService],
  exports: [VeiculosService],
})
export class VeiculosModule {}
