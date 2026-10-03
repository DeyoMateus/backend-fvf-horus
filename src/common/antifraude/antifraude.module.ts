import { Module } from '@nestjs/common';
import { AntifraudeService } from './antifraude.service';

@Module({
  providers: [AntifraudeService],
  exports: [AntifraudeService],
})
export class AntifraudeModule {}
