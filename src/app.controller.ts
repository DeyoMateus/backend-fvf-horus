import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Endpoint de health check (Rodada 33) , pra monitoramento de
   * uptime externo (UptimeRobot, Pingdom, um cron simples, etc.)
   * apontar pra cá em vez de só bater na raiz (que não confirma nada
   * além do processo Node estar de pé). Confirma que o backend
   * consegue de fato falar com o Postgres , é a dependência crítica
   * mais provável de falhar sem o processo cair (banco fora do ar,
   * connection pool esgotado, etc.). Sem autenticação de propósito:
   * é o padrão esperado por praticamente todo serviço de
   * monitoramento externo, e não expõe nenhum dado sensível.
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'erro',
        database: 'indisponivel',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
