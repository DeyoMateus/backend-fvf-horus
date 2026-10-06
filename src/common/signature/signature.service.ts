import { Injectable } from '@nestjs/common';
import { createVerify } from 'crypto';
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
      // Rodada 165: verificação com o `crypto` nativo do Node (OpenSSL), não
      // com o node-forge, cuja checagem de assinatura RSA PKCS#1 v1.5 tem
      // advisory sem correção (GHSA-86w9-cpqp-85rv). A assinatura (forge)
      // é o mesmo RSA-SHA256 PKCS#1 v1.5, então as já gravadas continuam
      // válidas; o node aceita o certificado X.509 em PEM como chave pública.
      const verificador = createVerify('RSA-SHA256');
      verificador.update(conteudo, 'utf8');
      return verificador.verify(certificadoPem, assinaturaBase64, 'base64');
    } catch {
      return false;
    }
  }
}
