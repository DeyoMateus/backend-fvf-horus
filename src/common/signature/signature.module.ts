import { Global, Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { SignatureService } from './signature.service';

@Global()
@Module({
  providers: [CertificateService, SignatureService],
  exports: [CertificateService, SignatureService],
})
export class SignatureModule {}
