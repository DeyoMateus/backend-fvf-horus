import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentosCargaService } from './documentos-carga.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Isolamento entre grupos para DocumentosCargaService. `upload()` tem
 * DOIS caminhos que resolvem o empresaId concreto do documento , via
 * `dto.motoristaId` (usa `verificarMotoristaNoGrupo`) ou via
 * `dto.empresaId` (usa `verificarEmpresaNoGrupo`) , e os dois precisam
 * bloquear um usuário do grupo A tentando anexar um documento a um
 * motorista/empresa que pertence ao grupo B. Também cobre
 * `listByMotorista`, que delega a mesma checagem antes de listar.
 */
describe('DocumentosCargaService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(opts: {
    motorista?: { empresaId: string; empresa: { grupoId: string } } | null;
    empresa?: { grupoId: string } | null;
  }) {
    const prismaMock = {
      motorista: {
        findUnique: jest.fn().mockResolvedValue(opts.motorista ?? null),
      },
      empresa: {
        findUnique: jest.fn().mockResolvedValue(opts.empresa ?? null),
      },
      documentoCarga: {
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const storageMock = {
      configurado: jest.fn().mockReturnValue(false),
    } as any;
    const filaArmazenamentoMock = { add: jest.fn() } as any;
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    // GeocodingService é a 4ª dependência do construtor (entre storage e
    // tenant) , faltava esse mock aqui, então cada argumento passado
    // "escorregava" uma posição: `tenant` caía no slot de `geocoding` e
    // `filaArmazenamentoMock` caía no slot de `tenant`, fazendo
    // `this.tenant.verificarMotoristaNoGrupo`/`verificarEmpresaNoGrupo`
    // virarem `undefined` (métodos não existem no mock da fila).
    const geocodingMock = {
      geocodificar: jest.fn().mockResolvedValue(null),
    } as any;

    const service = new DocumentosCargaService(
      prismaMock,
      auditMock,
      storageMock,
      geocodingMock,
      tenant,
      filaArmazenamentoMock,
    );
    return { service, prismaMock };
  }

  describe('upload , caminho via dto.motoristaId', () => {
    const arquivo = { buffer: Buffer.from('<xml/>'), originalname: 'doc.xml' };

    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        motorista: { empresaId: 'empresa-B', empresa: { grupoId: 'grupo-B' } },
      });
      await expect(
        service.upload(
          'grupo-A',
          'usuario-1',
          { motoristaId: 'motorista-1' } as any,
          arquivo,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando o motorista não existe', async () => {
      const { service } = criarServiceComPrismaMock({ motorista: null });
      await expect(
        service.upload(
          'grupo-A',
          'usuario-1',
          { motoristaId: 'motorista-x' } as any,
          arquivo,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('aceita o upload quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        motorista: { empresaId: 'empresa-A', empresa: { grupoId: 'grupo-A' } },
      });
      await expect(
        service.upload(
          'grupo-A',
          'usuario-1',
          { motoristaId: 'motorista-1' } as any,
          arquivo,
        ),
      ).resolves.toMatchObject({ id: 'doc-1' });
    });
  });

  describe('upload , caminho via dto.empresaId', () => {
    const arquivo = { buffer: Buffer.from('<xml/>'), originalname: 'doc.xml' };

    it('lança ForbiddenException quando a empresa pertence a outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(
        service.upload(
          'grupo-A',
          'usuario-1',
          { empresaId: 'empresa-1' } as any,
          arquivo,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aceita o upload quando a empresa pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresa: { grupoId: 'grupo-A' },
      });
      await expect(
        service.upload(
          'grupo-A',
          'usuario-1',
          { empresaId: 'empresa-1' } as any,
          arquivo,
        ),
      ).resolves.toMatchObject({ id: 'doc-1' });
    });
  });

  describe('listByMotorista', () => {
    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        motorista: { empresaId: 'empresa-B', empresa: { grupoId: 'grupo-B' } },
      });
      await expect(
        service.listByMotorista('motorista-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a consulta quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        motorista: { empresaId: 'empresa-A', empresa: { grupoId: 'grupo-A' } },
      });
      await expect(
        service.listByMotorista('motorista-1', 'grupo-A'),
      ).resolves.toEqual([]);
    });
  });
});
