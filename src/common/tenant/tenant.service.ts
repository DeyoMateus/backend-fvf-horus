import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Único lugar que traduz "grupoId de quem está pedindo" (o tenant real
 * desde que o modelo passou a suportar múltiplos CNPJs por login , ver
 * claude/arquitetura-seguranca-controle-jornada.md) em checagens de
 * propriedade sobre entidades que continuam presas a UMA Empresa (CNPJ)
 * específica, como Motorista e DocumentoCarga.
 *
 * Antes desta classe existir, cada service tinha sua própria cópia de
 * "conferirTenant" comparando `motorista.empresaId !== empresaIdDoToken`
 * direto. Isso deixou de fazer sentido no momento em que o token passou
 * a carregar grupoId (não mais empresaId) , centralizar aqui garante
 * que toda checagem passe pela mesma relação Empresa->Grupo, em vez de
 * cada arquivo reimplementar por conta própria e arriscar esquecer.
 */
@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /** Confirma que a empresa (CNPJ) pertence ao grupo de quem está pedindo. */
  async verificarEmpresaNoGrupo(
    empresaId: string,
    grupoId: string,
  ): Promise<void> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { grupoId: true },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    if (empresa.grupoId !== grupoId) {
      throw new ForbiddenException('Empresa não pertence ao seu grupo');
    }
  }

  /**
   * Confirma que o motorista pertence a uma empresa do grupo de quem
   * está pedindo, e devolve o empresaId real dele (útil pra quem
   * precisa, ex.: DocumentoCarga, notificação de WhatsApp por empresa,
   * hash genesis).
   */
  async verificarMotoristaNoGrupo(
    motoristaId: string,
    grupoId: string,
  ): Promise<{ empresaId: string }> {
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: { empresaId: true, empresa: { select: { grupoId: true } } },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    if (motorista.empresa.grupoId !== grupoId) {
      throw new ForbiddenException('Motorista não pertence ao seu grupo');
    }
    return { empresaId: motorista.empresaId };
  }

  /**
   * Mesma checagem de `verificarMotoristaNoGrupo`, para Ajudante
   * (Rodada 66) , cadastro separado do Motorista (sem CNH/veículo),
   * mas com o mesmo isolamento por tenant.
   */
  async verificarAjudanteNoGrupo(
    ajudanteId: string,
    grupoId: string,
  ): Promise<{ empresaId: string }> {
    const ajudante = await this.prisma.ajudante.findUnique({
      where: { id: ajudanteId },
      select: { empresaId: true, empresa: { select: { grupoId: true } } },
    });
    if (!ajudante) throw new NotFoundException('Ajudante não encontrado');
    if (ajudante.empresa.grupoId !== grupoId) {
      throw new ForbiddenException('Ajudante não pertence ao seu grupo');
    }
    return { empresaId: ajudante.empresaId };
  }

  /**
   * Bloqueia qualquer ESCRITA (lançar/ajustar jornada, vincular
   * dispositivo/veículo, conceder folga, aprovar solicitação, anexar
   * documento etc.) em nome de um motorista que não está mais ATIVO
   * (INATIVO/SUSPENSO) ou que já foi excluído (soft-delete) , pedido
   * explícito do usuário: "depois de excluído ou inativado não pode ser
   * possível acrescentar nem excluir nada, apenas consultar o que
   * passou". Não filtra NADA de leitura/consulta (histórico continua
   * 100% acessível) , só entra nos pontos de ESCRITA de cada service.
   * Chamar DEPOIS de `verificarMotoristaNoGrupo` (ou junto, se o
   * chamador já tiver o motorista em mãos).
   */
  async verificarMotoristaAtivo(motoristaId: string): Promise<void> {
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: { nome: true, status: true, excluidoEm: true },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    if (motorista.excluidoEm) {
      throw new ForbiddenException(
        `${motorista.nome} está com o cadastro excluído , só é possível consultar o histórico dele, não lançar ou alterar nada novo.`,
      );
    }
    if (motorista.status !== 'ATIVO') {
      throw new ForbiddenException(
        `${motorista.nome} está ${motorista.status === 'SUSPENSO' ? 'suspenso' : 'inativo'} , só é possível consultar o histórico dele, não lançar ou alterar nada novo.`,
      );
    }
  }

  /** Confirma que um documento de carga pertence a uma empresa do grupo de quem está pedindo. */
  async verificarDocumentoCargaNoGrupo(
    documentoId: string,
    grupoId: string,
  ): Promise<{ empresaId: string }> {
    const documento = await this.prisma.documentoCarga.findUnique({
      where: { id: documentoId },
      select: { empresaId: true, empresa: { select: { grupoId: true } } },
    });
    if (!documento) throw new NotFoundException('Documento não encontrado');
    if (documento.empresa.grupoId !== grupoId) {
      throw new ForbiddenException('Documento não pertence ao seu grupo');
    }
    return { empresaId: documento.empresaId };
  }
}
