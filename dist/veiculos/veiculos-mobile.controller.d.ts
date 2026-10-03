import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { VeiculosService } from './veiculos.service';
export declare class VeiculosMobileController {
    private readonly veiculosService;
    constructor(veiculosService: VeiculosService);
    atualizar(req: {
        motorista: {
            id: string;
        };
    }, dto: AtualizarVeiculoDto): Promise<{
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
    status(req: {
        motorista: {
            id: string;
        };
    }): Promise<{
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
}
