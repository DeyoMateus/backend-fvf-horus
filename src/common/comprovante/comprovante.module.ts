import { Module } from '@nestjs/common';
import { ComprovanteService } from './comprovante.service';

@Module({
  providers: [ComprovanteService],
  exports: [ComprovanteService],
})
export class ComprovanteModule {}
