import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';

/**
 * Assinatura digital não-repúdio (RSA-SHA256) de cada evento de
 * jornada , a mesma técnica usada para assinar comprovantes e
 * transações bancárias. Combinada com a cadeia de hashes, garante
 * duas propriedades independentes:
 *   - Integridade/ordem (hash chain): ninguém alterou ou reordenou o histórico.
 *   - Autenticidade/não-repúdio (assinatura): o evento foi de fato
 *     produzido usando o certificado daquele motorista específico.
 */
@Injectable()
export class SignatureService {
  assinar(privateKey: forge.pki.rsa.PrivateKey, conteudo: string): string {
    const md = forge.md.sha256.create();
    md.update(conteudo, 'utf8');
    const signature = privateKey.sign(md);
    return forge.util.encode64(signature);
  }

  verificar(
    certificadoPem: string,
    conteudo: string,
    assinaturaBase64: string,
  ): boolean {
    try {
      const cert = forge.pki.certificateFromPem(certificadoPem);
      const md = forge.md.sha256.create();
      md.update(conteudo, 'utf8');
      const signature = forge.util.decode64(assinaturaBase64);
      return (cert.publicKey as forge.pki.rsa.PublicKey).verify(
        md.digest().bytes(),
        signature,
      );
    } catch {
      return false;
    }
  }
}
