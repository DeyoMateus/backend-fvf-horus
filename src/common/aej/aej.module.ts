import { Module } from '@nestjs/common';
import { AejService } from './aej.service';

@Module({
  providers: [AejService],
  exports: [AejService],
})
export class AejModule {}
