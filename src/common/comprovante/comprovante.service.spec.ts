import { ComprovanteService } from './comprovante.service';

/**
 * Regressão: o comprovante em PDF precisa receber e imprimir os dados
 * da empresa (CNPJ do vínculo empregatício real do motorista) , antes
 * desta correção, `gerarPdfRegistros` nem recebia esse parâmetro, então
 * o PDF nunca mostrava qual CNPJ é o empregador. Não dá pra asserir o
 * texto dentro do PDF por aqui sem uma lib de parsing de PDF (o
 * conteúdo do pdfkit sai comprimido/deflate no buffer), então o teste
 * garante o que dá pra garantir sem essa dependência nova: a chamada
 * exige o parâmetro `empresa` (TypeScript barra em tempo de compilação
 * uma chamada sem ele , ver `tsc --noEmit` limpo) e o serviço gera um
 * PDF válido e não-vazio quando ele é passado.
 */
describe('ComprovanteService', () => {
  const motorista = {
    nome: 'Ana Souza',
    cpf: '11122233344',
    cnh: '99988877766',
    hashGenesis: 'g'.repeat(64),
  };

  const empresa = {
    razaoSocial: 'Transportes B Ltda',
    cnpj: '11.222.333/0001-44',
  };

  const registro = {
    sequencial: 1,
    tipoEvento: 'INICIO_JORNADA',
    timestampEvento: new Date('2026-09-21T08:00:00Z'),
    observacao: null,
    hashAtual: 'b'.repeat(64),
    deviceUuidUsado: 'device-1',
  } as any;

  it('gera um PDF válido e não-vazio quando a empresa do motorista é informada', async () => {
    const service = new ComprovanteService();
    const pdf = await service.gerarPdfRegistros(
      motorista,
      empresa,
      [registro],
      registro.timestampEvento,
      registro.timestampEvento,
    );

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('gera um PDF válido mesmo sem nenhum registro no período (extrato vazio)', async () => {
    const service = new ComprovanteService();
    const pdf = await service.gerarPdfRegistros(
      motorista,
      empresa,
      [],
      new Date('2026-09-01'),
      new Date('2026-09-21'),
    );

    expect(pdf.length).toBeGreaterThan(0);
  });
});
