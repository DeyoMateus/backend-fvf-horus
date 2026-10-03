import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { VeiculosService } from './veiculos.service';
export declare class VeiculosController {
    private readonly veiculosService;
    constructor(veiculosService: VeiculosService);
    atualizar(motoristaId: string, dto: AtualizarVeiculoDto, user: UsuarioAutenticado): Promise<{
        id: string;
        motoristaId: string;
        atualizadoEm: Date;
        criadoEm: Date;
        placa: string;
        idRastreador: string | null;
        tecnologiaRastreador: import("@prisma/client").$Enums.TecnologiaRastreador | null;
        atualizadoPorTipo: import("@prisma/client").$Enums.ActorType;
        atualizadoPorId: string | null;
    }>;
    status(motoristaId: string, user: UsuarioAutenticado): Promise<{
        id: string;
        motoristaId: string;
        atualizadoEm: Date;
        criadoEm: Date;
        placa: string;
        idRastreador: string | null;
        tecnologiaRastreador: import("@prisma/client").$Enums.TecnologiaRastreador | null;
        atualizadoPorTipo: import("@prisma/client").$Enums.ActorType;
        atualizadoPorId: string | null;
    } | {
        vinculado: boolean;
    }>;
    trocas(motoristaId: string, user: UsuarioAutenticado): Promise<{
        id: string;
        actorType: import("@prisma/client").$Enums.ActorType;
        actorId: string | null;
        acao: string;
        entidade: string;
        entidadeId: string | null;
        detalhes: import("@prisma/client/runtime/library").JsonValue | null;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        grupoId: string | null;
    }[]>;
}
