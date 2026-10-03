import { Module } from '@nestjs/common';
import { LimpezaTokensService } from './limpeza-tokens.service';

@Module({
  providers: [LimpezaTokensService],
})
export class LimpezaTokensModule {}
