import { Module } from '@nestjs/common';
import { NsrModule } from '../nsr/nsr.module';
import { RepPService } from './rep-p.service';

@Module({
  imports: [NsrModule],
  providers: [RepPService],
  exports: [RepPService],
})
export class RepPModule {}
