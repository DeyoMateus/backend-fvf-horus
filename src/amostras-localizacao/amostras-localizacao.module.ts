import { Module } from '@nestjs/common';
import { AmostrasLocalizacaoController } from './amostras-localizacao.controller';
import { AmostrasLocalizacaoService } from './amostras-localizacao.service';

@Module({
  controllers: [AmostrasLocalizacaoController],
  providers: [AmostrasLocalizacaoService],
})
export class AmostrasLocalizacaoModule {}
