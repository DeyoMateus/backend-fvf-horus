import { Module } from '@nestjs/common';
import { NsrService } from './nsr.service';

@Module({
  providers: [NsrService],
  exports: [NsrService],
})
export class NsrModule {}
