import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Logging estruturado (Rodada 34): fora de desenvolvimento, cada
  // linha de log vira um objeto JSON em vez de texto colorido de
  // terminal , não é "logging centralizado" por si só (isso ainda
  // depende de você escolher e configurar um serviço agregador), mas
  // é o pré-requisito de código: praticamente todo agregador de log e
  // todo orquestrador de container já sabe indexar JSON de `stdout`
  // sem nenhuma configuração extra do lado dele. Em dev continua
  // exatamente como antes (texto legível no terminal).
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
  });

  // Cabeçalhos HTTP de segurança (HSTS, no-sniff, sem X-Powered-By, CSP básica).
  app.use(helmet());

  // Compressão gzip/brotli das respostas , reduz bytes trafegados (importante
  // pro app do motorista em conexão de estrada ruim) e a carga de rede do
  // servidor sob volume alto de requisições simultâneas.
  app.use(compression());

  // CORS restrito: só as origens explicitamente configuradas podem chamar a API.
  // `allowedHeaders` inclui o header anti-CSRF (ver refresh-cookie.util.ts)
  // de propósito , sem listar explicitamente, o preflight de uma origem
  // NÃO permitida ainda seria bloqueado (o CORS já cuida disso), mas
  // listar aqui documenta a intenção e evita qualquer configuração de
  // proxy/CDN na frente que filtre headers não anunciados no preflight.
  const origensPermitidas = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .filter(Boolean);
  app.enableCors({
    origin: origensPermitidas.length > 0 ? origensPermitidas : false,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-fvf-horus-client',
      'x-fuso-offset-min',
    ],
  });

  // Validação estrita de entrada: rejeita qualquer campo não declarado no DTO
  // e converte tipos (evita injeção via campos extras / type juggling).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Necessário para @Ip() funcionar corretamente atrás de um load balancer/proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Rodada 94 , achado real: filtros de múltipla seleção (ex.: "ações"
  // na Trilha de auditoria) sempre deram 400 Bad Request. Causa: o
  // Express 5 (atualizado numa rodada anterior) trocou o parser de
  // query string padrão de 'extended' (biblioteca `qs`, entende
  // `campo[]=a&campo[]=b` como array) pra 'simple' (`querystring` nativo
  // do Node, que NÃO entende colchetes , gera uma chave literal
  // `"campo[]"` em vez de um array em `campo`). O axios do painel manda
  // arrays de query exatamente nesse formato `campo[]=...` (padrão da
  // biblioteca, não é algo que configuramos) , com `forbidNonWhitelisted`
  // ligado no ValidationPipe, essa chave "campo[]" não bate com nenhum
  // campo do DTO e a requisição inteira é rejeitada. Resultado: todo
  // filtro de múltipla escolha ficava mudo (o actorType sozinho, sem
  // colchete, continuava funcionando , por isso só os filtros
  // combinados com uma lista pareciam quebrados). Restaurar o parser
  // 'extended' (mesmo comportamento de antes do Express 5, `qs` já é
  // uma dependência transitiva do próprio Express) resolve pra este e
  // qualquer futuro filtro de lista por query string, sem precisar
  // mexer em cada DTO.
  app.getHttpAdapter().getInstance().set('query parser', 'extended');

  // Shutdown gracioso: ao escalar (deploy, autoscaling reduzindo instâncias),
  // dá tempo pro Prisma fechar o pool de conexões com o Postgres e pro
  // worker BullMQ terminar o job em andamento antes do processo morrer ,
  // sem isso, uma instância derrubada no meio de um job de fila (ex.: envio
  // de push, upload pro R2) simplesmente perde o trabalho.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
