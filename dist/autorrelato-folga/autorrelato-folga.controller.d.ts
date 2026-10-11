import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AutorrelatoFolgaService } from './autorrelato-folga.service';
import { TratarDiaSemInteracaoDto } from './dto/tratar-dia-sem-interacao.dto';
export declare class AutorrelatoFolgaController {
    private readonly service;
    constructor(service: AutorrelatoFolgaService);
    listarPorMotorista(id: string, user: UsuarioAutenticado): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        observacao: string | null;
    }[]>;
    diasSemInteracao(dias: string | undefined, user: UsuarioAutenticado): Promise<{
        motoristaId: string;
        nome: string;
        diasSemInteracao: string[];
    }[]>;
    tratarDiaSemInteracao(motoristaId: string, dto: TratarDiaSemInteracaoDto, user: UsuarioAutenticado): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoTratamentoDiaSemInteracao;
        observacao: string;
        tratadoPorUsuarioId: string;
    }>;
}
