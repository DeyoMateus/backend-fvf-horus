import { Module } from '@nestjs/common';
import { NsrModule } from '../nsr/nsr.module';
import { AfdService } from './afd.service';

@Module({
  imports: [NsrModule],
  providers: [AfdService],
  exports: [AfdService],
})
export class AfdModule {}
