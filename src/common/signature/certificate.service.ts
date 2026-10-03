import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import { createHash } from 'crypto';
import { EnvelopeEncryptionService } from '../crypto/envelope-encryption.service';

export interface CertificadoGerado {
  pfxBuffer: Buffer;
  fingerprint: string; // sha256 do certificado (hex)
  validoAte: Date;
}

export interface CertificadoDecodificado {
  privateKey: forge.pki.rsa.PrivateKey;
  certificadoPem: string;
  fingerprint: string;
}

/**
 * Ciclo de vida do certificado digital do motorista , assinando cada
 * RegistroJornada com um par de chaves RSA-2048 + certificado X.509,
 * empacotados em PKCS#12/PFX (mesmo formato usado por certificados
 * ICP-Brasil e por bancos para assinatura de transações).
 *
 * Rodada 29: cogitamos estender o mesmo mecanismo para o usuário do
 * RH/gestor assinar `TratamentoPonto`, mas pesquisa jurídica (Portaria
 * MTP 671/2021 art. 82 §único, CLT art. 74, jurisprudência do TST)
 * mostrou que não há exigência legal de assinatura criptográfica para
 * o "programa de tratamento" , só integridade/rastreabilidade (quem,
 * quando, por quê), que o `TratamentoPonto` já garante via
 * `usuarioId` + `hashRegistro`/`hashReferencia` (ancoragem no
 * hash-chain). Decisão do usuário: não vale o esforço de manter um
 * certificado por gestor só por não-repúdio técnico extra que a lei
 * não pede. Este serviço voltou a ser só do motorista.
 *
 * O PFX nunca é gravado em disco/banco em texto puro: quem chama este
 * serviço é responsável por passar o resultado pelo
 * `EnvelopeEncryptionService` antes de persistir, e por descriptografar
 * só no instante da assinatura (o material de chave privada vive em
 * memória o mínimo de tempo possível).
 *
 * A senha do PFX nunca é armazenada: é derivada deterministicamente da
 * chave mestra + id do motorista (`deriveKey`), então só quem tem a
 * KEK consegue abrir o PFX , mesmo com dump completo do banco de dados.
 */
@Injectable()
export class CertificateService {
  constructor(private readonly crypto: EnvelopeEncryptionService) {}

  private senhaPfx(id: string): string {
    return this.crypto.deriveKey(`pfx-passphrase:${id}`).toString('hex');
  }

  gerarParaMotorista(input: {
    id: string;
    nome: string;
    cpf: string;
    empresaCnpj: string;
  }): CertificadoGerado {
    return this.gerarCertificado(input.id, [
      { name: 'commonName', value: input.nome },
      { name: 'organizationalUnitName', value: `CPF:${input.cpf}` },
      {
        name: 'organizationName',
        value: `FVF Horus - CNPJ ${input.empresaCnpj}`,
      },
      { name: 'countryName', value: 'BR' },
    ]);
  }

  private gerarCertificado(
    id: string,
    atributos: Array<{ name: string; value: string }>,
  ): CertificadoGerado {
    const keys = forge.pki.rsa.generateKeyPair(2048);

    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = createHash('sha1')
      .update(id)
      .digest('hex')
      .slice(0, 16);

    const validoDesde = new Date();
    const validoAte = new Date(validoDesde);
    validoAte.setFullYear(validoAte.getFullYear() + 3);
    cert.validity.notBefore = validoDesde;
    cert.validity.notAfter = validoAte;

    cert.setSubject(atributos);
    // Autoridade certificadora interna da FVF Hórus (self-signed).
    // Em produção: substituir por uma CA interna com chave raiz em HSM.
    cert.setIssuer(atributos);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      {
        name: 'keyUsage',
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: false,
      },
      { name: 'extKeyUsage', clientAuth: true },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const pfxAsn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      this.senhaPfx(id),
      {
        algorithm: '3des',
      },
    );
    const pfxDer = forge.asn1.toDer(pfxAsn1).getBytes();
    const pfxBuffer = Buffer.from(pfxDer, 'binary');

    const certDer = forge.asn1
      .toDer(forge.pki.certificateToAsn1(cert))
      .getBytes();
    const fingerprint = createHash('sha256')
      .update(Buffer.from(certDer, 'binary'))
      .digest('hex');

    return { pfxBuffer, fingerprint, validoAte };
  }

  decodificar(id: string, pfxBuffer: Buffer): CertificadoDecodificado {
    const senha = this.senhaPfx(id);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

    const keyBags = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    if (!keyBag?.key || !certBag?.cert) {
      throw new Error('Não foi possível extrair chave/certificado do PFX');
    }

    const certDer = forge.asn1
      .toDer(forge.pki.certificateToAsn1(certBag.cert))
      .getBytes();
    const fingerprint = createHash('sha256')
      .update(Buffer.from(certDer, 'binary'))
      .digest('hex');

    return {
      privateKey: keyBag.key as forge.pki.rsa.PrivateKey,
      certificadoPem: forge.pki.certificateToPem(certBag.cert),
      fingerprint,
    };
  }
}
