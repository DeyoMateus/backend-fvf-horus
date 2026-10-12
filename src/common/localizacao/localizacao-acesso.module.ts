import { Global, Module } from '@nestjs/common';
import { LocalizacaoAcessoService } from './localizacao-acesso.service';

@Global()
@Module({
  providers: [LocalizacaoAcessoService],
  exports: [LocalizacaoAcessoService],
})
export class LocalizacaoAcessoModule {}
