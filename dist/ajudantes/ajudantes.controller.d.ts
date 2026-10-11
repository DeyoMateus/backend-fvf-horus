import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AjudantesService } from './ajudantes.service';
import { CreateAjudanteDto } from './dto/create-ajudante.dto';
import { AtualizarStatusAjudanteDto } from './dto/atualizar-status-ajudante.dto';
import { ExcluirAjudanteDto } from './dto/excluir-ajudante.dto';
import { VincularDispositivoAjudanteDto } from './dto/vincular-dispositivo-ajudante.dto';
export declare class AjudantesController {
    private readonly ajudantesService;
    constructor(ajudantesService: AjudantesService);
    create(dto: CreateAjudanteDto, user: UsuarioAutenticado): Promise<{
        id: string;
        nome: string;
        cpf: string;
        status: import("@prisma/client").StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string;
        certificadoValidoAte: Date;
        createdAt: Date;
    }>;
    list(user: UsuarioAutenticado, page?: string, pageSize?: string, busca?: string, incluirExcluidos?: string): Promise<{
        dados: {
            cpf: string;
            dispositivoVinculado: {
                deviceUuid: string;
            } | null;
            id: string;
            createdAt: Date;
            nome: string;
            status: import("@prisma/client").$Enums.StatusMotorista;
            certificadoValidoAte: Date | null;
            excluidoEm: Date | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    findOne(id: string, user: UsuarioAutenticado): Promise<{
        cpf: string;
        telefone: string | null;
        dispositivoVinculado: {
            deviceUuid: string;
            vinculadoEm: Date;
            atualizadoEm: Date;
        } | null;
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string | null;
        certificadoValidoAte: Date | null;
        excluidoEm: Date | null;
        motivoExclusao: string | null;
    }>;
    atualizarStatus(id: string, dto: AtualizarStatusAjudanteDto, user: UsuarioAutenticado): Promise<{
        cpf: string;
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StatusMotorista;
        empresaId: string;
    }>;
    excluir(id: string, dto: ExcluirAjudanteDto, user: UsuarioAutenticado): Promise<{
        cpf: string;
        id: string;
        nome: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        excluidoEm: Date | null;
    }>;
    vincularDispositivo(id: string, dto: VincularDispositivoAjudanteDto, user: UsuarioAutenticado): Promise<{
        ajudanteId: string;
        deviceUuid: string;
        vinculadoEm: Date;
        deviceApiKey: string;
    }>;
    statusDispositivo(id: string, user: UsuarioAutenticado): Promise<{
        deviceUuid: string;
        vinculadoPorUsuarioId: string;
        vinculadoEm: Date;
        atualizadoEm: Date;
    } | {
        vinculado: boolean;
    }>;
    revogarDispositivo(id: string, user: UsuarioAutenticado): Promise<void>;
}
