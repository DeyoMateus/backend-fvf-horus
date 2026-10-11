import { Module } from '@nestjs/common';
import {
  PrivacidadeMobileController,
  PrivacidadePainelController,
  PrivacidadePublicaController,
} from './privacidade.controller';
import { PrivacidadeService } from './privacidade.service';

@Module({
  controllers: [
    PrivacidadePublicaController,
    PrivacidadeMobileController,
    PrivacidadePainelController,
  ],
  providers: [PrivacidadeService],
})
export class PrivacidadeModule {}
