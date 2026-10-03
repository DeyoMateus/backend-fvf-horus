import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';

/**
 * Cliente de object storage compatível com S3 , usado com o Cloudflare R2
 * em produção (mesma API do S3, sem custo de egress, mais barato que
 * guardar arquivo binário como coluna `Bytes` no Postgres).
 *
 * **Implementação própria de PUT/GET assinado (SigV4), sem o SDK oficial
 * da AWS.** Decisão desta rodada: o `@aws-sdk/client-s3` traz ~40
 * pacotes transitivos (@aws-sdk/*, @smithy/*) só para dois métodos HTTP
 * simples. Neste ambiente de desenvolvimento específico (pasta do
 * projeto sincronizada por algo , provavelmente o OneDrive , que
 * intercorre com o `rename()` de diretórios do `node_modules`), cada
 * pacote transitivo novo é uma chance de instalação corrompida; o SDK
 * completo se mostrou impraticável de instalar de forma confiável nesta
 * sessão. Assinar SigV4 à mão é ~80 linhas de código bem entendido
 * (documentado pela AWS, usado por várias libs leves de mercado) e
 * elimina a dependência de peso , menos superfície de ataque e menos
 * risco de quebra de instalação em qualquer ambiente com o mesmo
 * problema. Usa só `crypto` (nativo do Node) e `fetch` (nativo desde o
 * Node 18) , nenhuma dependência nova.
 *
 * **Decisão consciente de escopo, independente da anterior**: sem as
 * credenciais reais do bucket R2 do usuário (`R2_*` no `.env`), este
 * serviço fica com `configurado()` retornando `false` e o app inteiro
 * continua funcionando exatamente como antes , o XML fica guardado no
 * Postgres (`xmlOriginal`), sem dependência externa nova em dev. Mesmo
 * padrão de fail-open já usado pra push notification e outras
 * integrações externas neste projeto.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly endpoint: string | undefined;
  private readonly bucket: string | undefined;
  private readonly accessKeyId: string | undefined;
  private readonly secretAccessKey: string | undefined;
  private readonly host: string | undefined;

  private static readonly REGIAO = 'auto';
  private static readonly SERVICO = 's3';

  constructor() {
    this.endpoint = process.env.R2_ENDPOINT;
    this.bucket = process.env.R2_BUCKET;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (this.endpoint) {
      this.host = new URL(this.endpoint).host;
    }
  }

  /** Se `false`, todo o resto da aplicação deve continuar usando o Postgres normalmente. */
  configurado(): boolean {
    return !!(
      this.endpoint &&
      this.bucket &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.host
    );
  }

  /** Sobe um objeto (ex.: XML de CT-e/MDF-e) pro bucket R2. Lança se não estiver configurado , quem chama decide o fallback. */
  async subirObjeto(
    chave: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    this.exigirConfigurado();
    const caminho = `/${this.bucket}/${StorageService.codificarCaminho(chave)}`;
    const payloadHash = createHash('sha256').update(buffer).digest('hex');
    const headers = this.assinar('PUT', caminho, payloadHash, {
      'content-type': contentType,
    });

    const resposta = await fetch(`${this.endpoint}${caminho}`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': contentType },
      body: new Uint8Array(buffer),
    });
    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => '');
      throw new Error(
        `R2 PUT "${chave}" respondeu ${resposta.status}: ${corpo}`,
      );
    }
  }

  /** Baixa um objeto do bucket R2 como Buffer. */
  async baixarObjeto(chave: string): Promise<Buffer> {
    this.exigirConfigurado();
    const caminho = `/${this.bucket}/${StorageService.codificarCaminho(chave)}`;
    const payloadHashVazio = createHash('sha256').update('').digest('hex');
    const headers = this.assinar('GET', caminho, payloadHashVazio, {});

    const resposta = await fetch(`${this.endpoint}${caminho}`, {
      method: 'GET',
      headers,
    });
    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => '');
      throw new Error(
        `R2 GET "${chave}" respondeu ${resposta.status}: ${corpo}`,
      );
    }
    const arrayBuffer = await resposta.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Exclui um objeto do bucket R2 , usado quando o gestor remove uma
   * evidência anexada (ver TratamentosPontoService.removerEvidencia /
   * SolicitacoesAjustePontoService.removerEvidencia): a linha some do
   * Postgres E o arquivo some do bucket, nunca um sem o outro.
   * Idempotente por natureza do S3 (DELETE num objeto que já não
   * existe também responde 2xx/404 sem erro) , não lança se o objeto
   * já não estiver lá.
   */
  async excluirObjeto(chave: string): Promise<void> {
    this.exigirConfigurado();
    const caminho = `/${this.bucket}/${StorageService.codificarCaminho(chave)}`;
    const payloadHashVazio = createHash('sha256').update('').digest('hex');
    const headers = this.assinar('DELETE', caminho, payloadHashVazio, {});

    const resposta = await fetch(`${this.endpoint}${caminho}`, {
      method: 'DELETE',
      headers,
    });
    if (!resposta.ok && resposta.status !== 404) {
      const corpo = await resposta.text().catch(() => '');
      throw new Error(
        `R2 DELETE "${chave}" respondeu ${resposta.status}: ${corpo}`,
      );
    }
  }

  /** Loga de forma consistente quando um upload assíncrono (fila) falha , nunca lança daqui pro processor decidir o retry do BullMQ. */
  logFalhaUpload(chave: string, erro: unknown) {
    this.logger.warn(
      `Falha ao subir objeto "${chave}" pro R2: ${(erro as Error).message}`,
    );
  }

  private exigirConfigurado() {
    if (!this.configurado())
      throw new Error(
        'Storage R2 não configurado (faltam variáveis R2_* no .env)',
      );
  }

  private static codificarCaminho(chave: string): string {
    // Codifica cada segmento (preserva as barras da "pasta" virtual) ,
    // as chaves usadas neste projeto só têm uuid/empresaId/extensão, mas
    // isso mantém a implementação correta pra qualquer chave.
    return chave.split('/').map(encodeURIComponent).join('/');
  }

  /** Assinatura AWS SigV4 pro Cloudflare R2 (compatível com a API S3). Ver: https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request-examples.html */
  private assinar(
    metodo: string,
    caminho: string,
    payloadHash: string,
    extras: Record<string, string>,
  ): Record<string, string> {
    const agora = new Date();
    const amzDate = agora.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
    const dataStamp = amzDate.slice(0, 8); // YYYYMMDD

    const cabecalhosParaAssinar: Record<string, string> = {
      host: this.host as string,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    const nomesOrdenados = Object.keys(cabecalhosParaAssinar).sort();
    const cabecalhosCanonicos = nomesOrdenados
      .map((nome) => `${nome}:${cabecalhosParaAssinar[nome]}\n`)
      .join('');
    const cabecalhosAssinados = nomesOrdenados.join(';');

    const requisicaoCanonica = [
      metodo,
      caminho,
      '',
      cabecalhosCanonicos,
      cabecalhosAssinados,
      payloadHash,
    ].join('\n');

    const escopoCredencial = `${dataStamp}/${StorageService.REGIAO}/${StorageService.SERVICO}/aws4_request`;
    const stringParaAssinar = [
      'AWS4-HMAC-SHA256',
      amzDate,
      escopoCredencial,
      createHash('sha256').update(requisicaoCanonica).digest('hex'),
    ].join('\n');

    const hmac = (chave: Buffer | string, dado: string) =>
      createHmac('sha256', chave).update(dado).digest();
    const kData = hmac(`AWS4${this.secretAccessKey}`, dataStamp);
    const kRegiao = hmac(kData, StorageService.REGIAO);
    const kServico = hmac(kRegiao, StorageService.SERVICO);
    const kAssinatura = hmac(kServico, 'aws4_request');
    const assinatura = hmac(kAssinatura, stringParaAssinar).toString('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${escopoCredencial}, SignedHeaders=${cabecalhosAssinados}, Signature=${assinatura}`;

    return {
      host: this.host as string,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
      ...extras,
    };
  }
}
