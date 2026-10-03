import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global de erros. Nunca devolve stacktrace, mensagem interna
 * de banco/Prisma ou detalhes de implementação ao cliente , só um
 * código de erro estável e uma mensagem genérica. O detalhe completo
 * vai só para o log do servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const mensagemPublica =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Erro interno. Tente novamente mais tarde.';

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response
      .status(status)
      .json(
        typeof mensagemPublica === 'string'
          ? { statusCode: status, message: mensagemPublica }
          : { statusCode: status, ...mensagemPublica },
      );
  }
}
