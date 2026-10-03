import { Module } from '@nestjs/common';
import { RelogioConfiavelService } from './relogio-confiavel.service';

@Module({
  providers: [RelogioConfiavelService],
  exports: [RelogioConfiavelService],
})
export class RelogioConfiavelModule {}
