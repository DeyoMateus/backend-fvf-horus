import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { DispositivosService } from './dispositivos.service';
import { RejeitarSolicitacaoTrocaDto } from './dto/rejeitar-solicitacao-troca.dto';
import { SolicitarTrocaDispositivoDto } from './dto/solicitar-troca-dispositivo.dto';
export declare class SolicitacoesTrocaDispositivoController {
    private readonly dispositivosService;
    constructor(dispositivosService: DispositivosService);
    solicitar(dto: SolicitarTrocaDispositivoDto): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.StatusSolicitacaoDispositivo;
        motoristaId: string;
        deviceUuidSolicitado: string;
        modeloAparelho: string | null;
        sistemaOperacional: string | null;
        observacaoMotorista: string | null;
        revisadoPorUsuarioId: string | null;
        revisadoEm: Date | null;
        motivoRejeicao: string | null;
        criadoEm: Date;
    }>;
    listarPendentes(user: UsuarioAutenticado): Promise<({
        motorista: {
            id: string;
            nome: string;
            cpf: string;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.StatusSolicitacaoDispositivo;
        motoristaId: string;
        deviceUuidSolicitado: string;
        modeloAparelho: string | null;
        sistemaOperacional: string | null;
        observacaoMotorista: string | null;
        revisadoPorUsuarioId: string | null;
        revisadoEm: Date | null;
        motivoRejeicao: string | null;
        criadoEm: Date;
    })[]>;
    aprovar(id: string, user: UsuarioAutenticado): Promise<{
        motoristaId: string;
        deviceUuid: string;
        vinculadoEm: Date;
        deviceApiKey: string;
    }>;
    rejeitar(id: string, dto: RejeitarSolicitacaoTrocaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.StatusSolicitacaoDispositivo;
        motoristaId: string;
        deviceUuidSolicitado: string;
        modeloAparelho: string | null;
        sistemaOperacional: string | null;
        observacaoMotorista: string | null;
        revisadoPorUsuarioId: string | null;
        revisadoEm: Date | null;
        motivoRejeicao: string | null;
        criadoEm: Date;
    }>;
}
