import { Module } from '@nestjs/common';
import { UsuariosEmpresaController } from './usuarios-empresa.controller';
import { UsuariosEmpresaService } from './usuarios-empresa.service';

@Module({
  controllers: [UsuariosEmpresaController],
  providers: [UsuariosEmpresaService],
})
export class UsuariosEmpresaModule {}
