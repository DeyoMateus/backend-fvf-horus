import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';
import { StorageModule } from '../common/storage/storage.module';
import { RegistrosJornadaModule } from '../registros-jornada/registros-jornada.module';
import { TratamentosPontoController } from './tratamentos-ponto.controller';
import { TratamentosPontoMobileController } from './tratamentos-ponto-mobile.controller';
import { TratamentosPontoService } from './tratamentos-ponto.service';

@Module({
  // Rodada 93 , RegistrosJornadaModule entra aqui só pra
  // TratamentosPontoService conseguir chamar
  // RegistrosJornadaService.verificarEAgendarProximoMotorista logo
  // depois de criar/aprovar um ajuste (ver o comentário em
  // criarRegistroAncorado). Sem risco de dependência circular:
  // RegistrosJornadaModule não importa nada daqui.
  imports: [StorageModule, PushNotificationsModule, RegistrosJornadaModule],
  controllers: [TratamentosPontoController, TratamentosPontoMobileController],
  providers: [TratamentosPontoService],
  exports: [TratamentosPontoService],
})
export class TratamentosPontoModule {}
