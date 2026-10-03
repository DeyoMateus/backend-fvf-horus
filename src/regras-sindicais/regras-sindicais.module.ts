import { Module } from '@nestjs/common';
import { RegrasSindicaisController } from './regras-sindicais.controller';
import { RegrasSindicaisService } from './regras-sindicais.service';

@Module({
  controllers: [RegrasSindicaisController],
  providers: [RegrasSindicaisService],
  exports: [RegrasSindicaisService],
})
export class RegrasSindicaisModule {}
