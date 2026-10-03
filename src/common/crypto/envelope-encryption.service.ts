import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';

export interface EnvelopeCiphertext {
  ciphertext: Buffer;
  iv: string; // hex
  authTag: string; // hex
}

/**
 * Envelope encryption (AES-256-GCM) para dados sensíveis em repouso ,
 * hoje o certificado digital (PFX) de cada motorista.
 *
 * Padrão bancário aplicado aqui:
 *  - Uma chave mestra (KEK) fica fora do banco, apenas em variável de
 *    ambiente / secret manager (nunca no código ou no schema).
 *  - Cada operação de cifra usa AES-256-GCM (autenticado), com IV
 *    aleatório de 96 bits por registro e AAD (associated data) ligando
 *    o texto cifrado à entidade dona do segredo (motoristaId), o que
 *    impede reaproveitar um ciphertext em outro registro ("ciphertext
 *    swapping").
 *  - Chaves derivadas por contexto via HKDF-SHA256 a partir da KEK,
 *    nunca a KEK "crua" é usada diretamente para cifrar payloads
 *    variados , reduz o raio de impacto se uma chave derivada vazar.
 *
 * Em produção, a KEK deve vir de um KMS/HSM gerenciado (AWS KMS, GCP
 * KMS, Azure Key Vault, HashiCorp Vault Transit) com rotação
 * automática; a variável de ambiente aqui é o ponto de troca para essa
 * integração sem alterar o restante do domínio.
 */
@Injectable()
export class EnvelopeEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EnvelopeEncryptionService.name);
  private masterKey!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const hex = this.config.get<string>('CRYPTO_MASTER_KEY');
    if (!hex || hex.length !== 64) {
      throw new InternalServerErrorException(
        'CRYPTO_MASTER_KEY ausente ou inválida: defina 64 caracteres hex (32 bytes) no .env',
      );
    }
    this.masterKey = Buffer.from(hex, 'hex');
    this.logger.log(
      'Chave mestra de criptografia carregada (envelope encryption ativo)',
    );
  }

  /** Deriva uma subchave de 32 bytes ligada a um contexto (ex.: "pfx:<motoristaId>"). */
  deriveKey(context: string): Buffer {
    const derived = hkdfSync(
      'sha256',
      this.masterKey,
      Buffer.alloc(0),
      Buffer.from(context, 'utf8'),
      32,
    );
    return Buffer.from(derived);
  }

  encrypt(plaintext: Buffer, aad: string): EnvelopeCiphertext {
    const key = this.deriveKey(`envelope:${aad}`);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(
    ciphertext: Buffer,
    ivHex: string,
    authTagHex: string,
    aad: string,
  ): Buffer {
    const key = this.deriveKey(`envelope:${aad}`);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
