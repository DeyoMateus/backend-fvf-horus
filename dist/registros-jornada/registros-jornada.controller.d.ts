import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AejService } from '../common/aej/aej.service';
import { ComprovanteService } from '../common/comprovante/comprovante.service';
import { RepPService } from '../common/rep-p/rep-p.service';
import { FeriadosService } from '../feriados/feriados.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';
import { LoteRegistroJornadaDto } from './dto/lote-registro-jornada.dto';
import { RegistrosJornadaService } from './registros-jornada.service';
export declare class RegistrosJornadaController {
    private readonly registrosService;
    private readonly comprovanteService;
    private readonly aejService;
    private readonly repPService;
    private readonly feriadosService;
    private readonly prisma;
    private readonly tenant;
    constructor(registrosService: RegistrosJornadaService, comprovanteService: ComprovanteService, aejService: AejService, repPService: RepPService, feriadosService: FeriadosService, prisma: PrismaService, tenant: TenantService);
    create(req: {
        motorista: {
            id: string;
        };
        deviceUuid: string;
    }, dto: CreateRegistroJornadaDto, ip: string, userAgent?: string): Promise<{
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        precisaoGpsM: number | null;
        odometro: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        elapsedRealtimeMs: number | null;
        idempotencyKey: string | null;
    }>;
    criarLote(req: {
        motorista: {
            id: string;
        };
        deviceUuid: string;
    }, dto: LoteRegistroJornadaDto, ip: string, userAgent?: string): Promise<import("./lote-registros-jornada.constants").ResultadoItemLote[]>;
    meusRegistros(req: {
        motorista: {
            id: string;
        };
    }, inicio?: string, fim?: string): Promise<{
        idLocal: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: string;
        latitude: number | null;
        longitude: number | null;
        precisaoGpsM: number | null;
        observacao: string | null;
        fusoOffsetMin: number | null;
        criadoEm: string;
    }[]>;
    meuComprovante(req: {
        motorista: {
            id: string;
        };
    }, res: Response, inicio?: string, fim?: string): Promise<void>;
    meuComprovanteRegistro(req: {
        motorista: {
            id: string;
        };
    }, res: Response, idLocal: string): Promise<void>;
    list(motoristaId: string, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        precisaoGpsM: number | null;
        odometro: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        elapsedRealtimeMs: number | null;
        idempotencyKey: string | null;
    }[]>;
    verificarIntegridade(motoristaId: string, user: UsuarioAutenticado): Promise<{
        motoristaId: string;
        cadeiaValida: boolean;
        motivoCadeia: string | undefined;
        primeiraQuebraSequencial: number | undefined;
        divergencias: {
            sequencial: number;
            motivoTecnico: string;
            explicacao: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento | null;
            timestampEvento: Date | null;
            criadoEm: Date | null;
            temGps: boolean;
            aceita: boolean;
            aceite: {
                motivo: string;
                aceitoPorNome: string;
                aceitoEm: Date;
            } | null;
        }[];
        totalRegistros: number;
        certificadoFingerprintOk: boolean;
        assinaturasInvalidas: number[];
        integro: boolean;
    }>;
    analisarEventoIntegridade(motoristaId: string, sequencial: string, user: UsuarioAutenticado): Promise<{
        motoristaId: string;
        divergente: boolean;
        explicacao: string;
        evento: {
            sequencial: number;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            criadoEm: Date;
            latitude: number | null;
            longitude: number | null;
            precisaoGpsM: number | null;
            odometro: number | null;
            observacao: string | null;
            fusoOffsetMin: number | null;
            deviceUuidUsado: string;
        };
        anterior: {
            sequencial: number;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            criadoEm: Date;
        } | null;
        proximo: {
            sequencial: number;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            criadoEm: Date;
        } | null;
        verificacao: {
            hashAnteriorConfere: boolean;
            hashAnteriorGravado: string;
            hashAnteriorEsperado: string;
            hashConfere: boolean;
            hashGravado: string;
            hashRecalculado: string;
            payloadCanonico: string;
            tentativas: {
                descricao: string;
                bate: boolean;
            }[];
            variacaoQueBate: string | null;
        };
        aceite: {
            motivo: string;
            aceitoPorNome: string;
            aceitoEm: Date;
        } | null;
    }>;
    aceitarDivergenciaIntegridade(motoristaId: string, sequencial: string, motivo: string, user: UsuarioAutenticado): Promise<{
        aceitoPorUsuario: {
            nome: string;
        };
    } & {
        id: string;
        motoristaId: string;
        sequencial: number;
        motivo: string;
        aceitoPorUsuarioId: string;
        aceitoEm: Date;
    }>;
    viagens(motoristaId: string, user: UsuarioAutenticado): Promise<import("./registros-jornada.service").ViagemConsolidada[]>;
    aej(motoristaId: string, res: Response, user: UsuarioAutenticado, inicio?: string, fim?: string): Promise<void>;
    comprovante(motoristaId: string, res: Response, user: UsuarioAutenticado, inicio?: string, fim?: string): Promise<void>;
    espelhoRepP(motoristaId: string, res: Response, user: UsuarioAutenticado, inicio?: string, fim?: string): Promise<void>;
    meuEspelhoRepP(req: {
        motorista: {
            id: string;
        };
    }, res: Response, inicio?: string, fim?: string): Promise<void>;
    private responderEspelhoRepP;
    private responderComprovante;
}
