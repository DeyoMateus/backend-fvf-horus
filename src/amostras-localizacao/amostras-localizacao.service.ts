import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AmostraLocalizacaoItemDto } from './dto/create-amostras-localizacao.dto';

@Injectable()
export class AmostrasLocalizacaoService {
  private readonly logger = new Logger(AmostrasLocalizacaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrarLote(motoristaId: string, amostras: AmostraLocalizacaoItemDto[]): Promise<{ gravadas: number }> {
    const resultado = await this.prisma.amostraLocalizacao.createMany({
      data: amostras.map((a) => ({
        motoristaId,
        latitude: a.latitude,
        longitude: a.longitude,
        precisaoGpsM: a.precisaoGpsM ?? null,
        capturadoEm: new Date(a.capturadoEm),
      })),
    });
    this.logger.log(`${resultado.count} amostra(s) de localização gravadas para motorista ${motoristaId}`);
    return { gravadas: resultado.count };
  }
}
