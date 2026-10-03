import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { AtualizarStatusMotoristaDto } from './dto/atualizar-status-motorista.dto';
import { AtualizarCadastroMotoristaDto } from './dto/atualizar-cadastro-motorista.dto';
import { ExcluirMotoristaDto } from './dto/excluir-motorista.dto';
import { MotoristasService } from './motoristas.service';
export declare class MotoristasController {
    private readonly motoristasService;
    constructor(motoristasService: MotoristasService);
    create(dto: CreateMotoristaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        nome: string;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string;
        certificadoValidoAte: Date;
        createdAt: Date;
    }>;
    list(user: UsuarioAutenticado, page?: string, pageSize?: string, busca?: string, incluirExcluidos?: string): Promise<{
        dados: {
            dispositivoVinculado: {
                deviceUuid: string;
            } | null;
            veiculoVinculado: {
                placa: string;
            } | null;
            id: string;
            createdAt: Date;
            nome: string;
            cpf: string;
            status: import("@prisma/client").$Enums.StatusMotorista;
            certificadoValidoAte: Date | null;
            excluidoEm: Date | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    findOne(id: string, user: UsuarioAutenticado): Promise<{
        dispositivoVinculado: {
            deviceUuid: string;
            vinculadoEm: Date;
            atualizadoEm: Date;
        } | null;
        veiculoVinculado: {
            atualizadoEm: Date;
            placa: string;
            idRastreador: string | null;
            tecnologiaRastreador: import("@prisma/client").$Enums.TecnologiaRastreador | null;
        } | null;
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        telefone: string | null;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string | null;
        certificadoValidoAte: Date | null;
        excluidoEm: Date | null;
        motivoExclusao: string | null;
    }>;
    atualizarCadastro(id: string, dto: AtualizarCadastroMotoristaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        telefone: string | null;
        empresaId: string;
    }>;
    atualizarStatus(id: string, dto: AtualizarStatusMotoristaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        empresaId: string;
    }>;
    excluir(id: string, dto: ExcluirMotoristaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        nome: string;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        excluidoEm: Date | null;
    }>;
    alertasIntegridadeDispositivo(id: string, user: UsuarioAutenticado): Promise<{
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
