import type { Motorista } from '@prisma/client';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { HoleriteService } from '../holerite/holerite.service';
import { AtualizarPerfilMotoristaDto } from './dto/atualizar-perfil-motorista.dto';
import { MotoristasService } from './motoristas.service';
type RequisicaoMotorista = {
    motorista: Motorista;
    grupoId: string;
};
export declare class MotoristasMobileController {
    private readonly motoristasService;
    private readonly holerite;
    private readonly bancoHoras;
    constructor(motoristasService: MotoristasService, holerite: HoleriteService, bancoHoras: BancoHorasService);
    obterMeuPerfil(req: RequisicaoMotorista): Promise<{
        id: string;
        nome: string;
        cpf: string;
        telefone: string | null;
    }>;
    atualizarMeuPerfil(req: RequisicaoMotorista, dto: AtualizarPerfilMotoristaDto): Promise<{
        id: string;
        nome: string;
        cpf: string;
        telefone: string | null;
    }>;
    minhasHoras(req: RequisicaoMotorista, anoQuery?: string, mesQuery?: string): Promise<{
        periodoInicio: Date;
        periodoFim: Date;
        ehMesAtual: boolean;
        horasMes: {
            direcaoMin: number;
            esperaMin: number;
            normalMin: number;
            extraMin: number;
            noturnoMin: number;
            indefinidoMin: number;
        };
        bancoHoras: {
            ativo: boolean;
            saldoMesMin: number;
            saldoTotalMin: number;
        } | null;
    }>;
}
export {};
