import { Global, Module } from '@nestjs/common';
import { EnvelopeEncryptionService } from './envelope-encryption.service';

@Global()
@Module({
  providers: [EnvelopeEncryptionService],
  exports: [EnvelopeEncryptionService],
})
export class CryptoModule {}
