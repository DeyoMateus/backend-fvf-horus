import { Injectable, Logger } from '@nestjs/common';

/**
 * Envio de e-mail transacional (hoje só usado pelo fluxo de
 * recuperação de senha , Rodada 33). Mesmo padrão de fail-open já
 * usado em toda integração externa deste projeto (R2, WhatsApp,
 * Geocoding): sem `RESEND_API_KEY` configurada no `.env`, este
 * serviço não falha nem bloqueia o fluxo , em vez de enviar de
 * verdade, LOGA o conteúdo do e-mail no console com um aviso bem
 * visível de "MODO SIMULADO", para que o desenvolvimento e os testes
 * continuem funcionando sem depender de nenhuma credencial real.
 *
 * Usa a API HTTP da Resend (https://resend.com) direto via `fetch`
 * nativo, sem SDK , mesma decisão de "menos dependências transitivas"
 * já tomada para o cliente do R2 (`storage.service.ts`) neste
 * ambiente, onde instalar pacote novo é uma fonte recorrente de risco
 * (ver comentário daquele arquivo). Trocar de provedor de e-mail no
 * futuro (SendGrid, SES, Postmark, etc.) é só reescrever o método
 * `enviarViaProvedor` , o resto do app nunca chama a API do provedor
 * diretamente, só `EmailService.enviar(...)`.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  configurado(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  /**
   * Envia um e-mail simples em texto/HTML. Nunca lança , falha de
   * envio é logada e engolida (fail-open), igual ao restante das
   * integrações externas do projeto: o chamador (ex.: fluxo de
   * "esqueci minha senha") não deve travar nem revelar ao usuário se
   * o envio funcionou ou não, por questão de segurança (anti
   * enumeração de e-mail) e de robustez.
   */
  async enviar(
    destinatario: string,
    assunto: string,
    corpoHtml: string,
  ): Promise<void> {
    if (!this.configurado()) {
      this.logger.warn(
        `[MODO SIMULADO , RESEND_API_KEY não configurada] E-mail não enviado de verdade.\n` +
          `Para: ${destinatario}\nAssunto: ${assunto}\n---\n${corpoHtml}\n---`,
      );
      return;
    }

    try {
      await this.enviarViaProvedor(destinatario, assunto, corpoHtml);
    } catch (err) {
      this.logger.error(
        `Falha ao enviar e-mail para ${destinatario}`,
        err as Error,
      );
    }
  }

  private async enviarViaProvedor(
    destinatario: string,
    assunto: string,
    corpoHtml: string,
  ): Promise<void> {
    const remetente =
      process.env.RESEND_FROM_EMAIL ?? 'FVF Hórus <onboarding@resend.dev>';

    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remetente,
        to: [destinatario],
        subject: assunto,
        html: corpoHtml,
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      throw new Error(`Resend respondeu ${resposta.status}: ${texto}`);
    }
  }
}
