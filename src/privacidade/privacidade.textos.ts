/**
 * Rodada 206 (LGPD): textos vigentes, versionados. Qualquer mudança de
 * conteúdo exige nova VERSAO_DOCUMENTOS (o app pede nova ciência).
 * RASCUNHO PARA REVISÃO JURÍDICA antes do uso com motoristas reais.
 */
export const VERSAO_DOCUMENTOS = '2026-10-11';

/** Prazo legal de resposta ao titular (LGPD art. 19, II): 15 dias. */
export const PRAZO_RESPOSTA_TITULAR_DIAS = 15;

export interface DadosControlador {
  razaoSocial: string;
  cnpj: string;
  encarregadoNome: string | null;
  encarregadoEmail: string | null;
  encarregadoTelefone: string | null;
}

export function montarDocumentos(c: DadosControlador | null) {
  const controlador = c
    ? `${c.razaoSocial} (CNPJ ${c.cnpj})`
    : 'a empresa transportadora que contratou o FVF Hórus (seu empregador)';
  const encarregado = c?.encarregadoNome
    ? `${c.encarregadoNome}${c.encarregadoEmail ? `, e-mail ${c.encarregadoEmail}` : ''}${c.encarregadoTelefone ? `, telefone ${c.encarregadoTelefone}` : ''}`
    : 'não há uma pessoa específica nomeada pela sua empresa; use a opção "Privacidade" do aplicativo (o pedido chega ao gestor da empresa) ou fale com o RH';

  const politica = `POLÍTICA DE PRIVACIDADE DO FVF HÓRUS (versão ${VERSAO_DOCUMENTOS})

1. Quem trata os seus dados
O controlador dos seus dados pessoais é ${controlador}, seu empregador, que decide por que e como os dados de jornada são usados. A FVF Hórus é a operadora: fornece o sistema e trata os dados apenas conforme as instruções do controlador. Encarregado (DPO) do controlador: ${encarregado}.

2. Quais dados coletamos
- Identificação: nome, CPF, CNH e telefone, informados no cadastro pela sua empresa.
- Jornada: cada marcação (início/fim de jornada, direção, descanso, espera etc.) com data, hora, fuso horário e observações.
- Localização (GPS): coordenadas no momento de cada marcação e, quando o aplicativo está autorizado, amostras periódicas (uma por hora) durante a jornada.
- Aparelho e segurança: identificador do aparelho vinculado, indicadores de integridade (por exemplo, relógio alterado ou localização simulada) e registros de acesso.
- Anexos e comunicações: evidências de ajustes de ponto e mensagens de alerta enviadas a você.
Não coletamos dados de saúde, biometria, religião, opinião política ou outros dados pessoais sensíveis (art. 5º, II da LGPD).

3. Para que usamos (finalidades) e bases legais
- Registrar e controlar a jornada de trabalho, calcular horas, descansos e limites da Lei 13.103/2015 e da CLT, gerar comprovantes, espelho de ponto e arquivos exigidos pela fiscalização do trabalho: execução do contrato de trabalho (art. 7º, V) e cumprimento de obrigação legal (art. 7º, II).
- Avisar você e a sua empresa sobre limites legais de direção e descanso e para a segurança da operação: obrigação legal e legítimo interesse do empregador na segurança do trabalho (art. 7º, IX), com o menor dado possível.
- Prevenir fraude e garantir a integridade dos registros (hash encadeado, verificação de relógio e aparelho): legítimo interesse e exercício regular de direitos (art. 7º, VI e IX).
- Cumprir ordens da fiscalização e defender direitos em processos: obrigação legal e exercício regular de direitos.
Não usamos seus dados para publicidade, perfilamento comercial ou venda a terceiros.

4. Localização
A localização é usada somente para comprovar onde a marcação foi feita e para a segurança da jornada. Ela é coletada apenas durante a jornada e não é usada para vigiar você fora do trabalho. Se você negar a permissão, a marcação continua possível, mas a localização não será registrada.

5. Com quem compartilhamos
Seu empregador (gestores autorizados do painel e a equipe de gerenciamento de risco), a fiscalização do trabalho e autoridades quando houver obrigação legal, e fornecedores de infraestrutura que atuam como suboperadores sob contrato (hospedagem, armazenamento de arquivos e backup, envio de notificações push e mensagens de alerta). Não vendemos seus dados. Pode haver processamento em servidores fora do Brasil por esses fornecedores, com as garantias do art. 33 da LGPD.

6. Por quanto tempo guardamos
Os registros de jornada e a localização vinculada a eles ficam guardados enquanto durar o contrato e pelo prazo exigido pela legislação trabalhista e previdenciária e de prescrição de ações (em regra, 5 anos durante o contrato e até 2 anos após o seu término), e depois são eliminados ou anonimizados, salvo obrigação legal ou processo em andamento que exija guarda maior. Esses registros têm proteção de integridade (não podem ser alterados nem apagados) justamente para servirem de prova. Dados de acesso e logs técnicos são guardados por prazo menor, conforme o Marco Civil da Internet.

7. Segurança
Usamos criptografia em trânsito, criptografia de CPF, CNH e telefone no banco de dados, controle de acesso por perfil, isolamento entre empresas, trilha de auditoria e cópias de segurança. Em caso de incidente que possa causar risco ou dano relevante, o controlador e a ANPD serão comunicados, e você será informado nos termos do art. 48 da LGPD.

8. Seus direitos (art. 18)
Você pode pedir: confirmação de que tratamos seus dados; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; portabilidade; informação sobre com quem compartilhamos; informação sobre a possibilidade de não consentir; revogação do consentimento (quando esta for a base); e revisão de decisões automatizadas. Use a opção "Privacidade e meus direitos" no aplicativo ou fale com o encarregado. Respondemos em até 15 dias. Pedidos de eliminação podem ser recusados, com justificativa, quando o dado precisa ser guardado por obrigação legal ou para exercício de direitos (art. 16).

9. Decisões automatizadas
Os alertas de jornada e os indicadores de integridade são calculados automaticamente a partir de regras legais objetivas. Eles não encerram, punem ou descontam nada por si só: qualquer consequência depende de análise humana do seu empregador, e você pode pedir revisão.

10. Crianças e adolescentes
O sistema é destinado a trabalhadores maiores de 18 anos.

11. Alterações
Quando este documento mudar, o aplicativo pedirá uma nova ciência. A versão em vigor é a ${VERSAO_DOCUMENTOS}.

12. Reclamações
Se não ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) em gov.br/anpd.`;

  const termoGps = `TERMO DE CIÊNCIA SOBRE LOCALIZAÇÃO (GPS) (versão ${VERSAO_DOCUMENTOS})

Estou ciente de que, ao usar o FVF Hórus a serviço de ${controlador}:
1. O aplicativo registra a minha localização no momento de cada marcação de ponto e, se eu autorizar a permissão de localização em segundo plano, uma amostra por hora durante a jornada.
2. A localização serve para comprovar o local do registro, apoiar a segurança da operação e a segurança do trabalho, e cumprir obrigações legais. Não é usada fora do horário de trabalho nem para fins pessoais ou comerciais.
3. A localização pode ser vista pelos gestores autorizados da minha empresa e pela equipe de gerenciamento de risco, e fornecida à fiscalização quando exigido por lei.
4. Posso negar ou retirar a permissão nas configurações do telefone; nesse caso a marcação continua possível, mas sem coordenadas, e isso fica registrado.
5. Posso exercer meus direitos de titular (acesso, correção, informação etc.) na opção "Privacidade e meus direitos" do aplicativo.`;

  const termoDados = `TERMO DE CIÊNCIA SOBRE DADOS PESSOAIS (versão ${VERSAO_DOCUMENTOS})

Estou ciente de que, para controlar a minha jornada de trabalho, ${controlador} e o sistema FVF Hórus guardam os seguintes dados pessoais meus:
1. Identificação: nome completo, CPF, número da CNH e telefone.
2. Vínculo: a empresa em que trabalho, minha situação (ativo/inativo) e o aparelho de celular vinculado ao meu cadastro.
3. Jornada: todas as marcações de ponto que faço (tipo, data, hora, fuso horário e observações) e os ajustes de ponto feitos por mim ou pelo RH.
4. Alertas e avisos de jornada gerados sobre mim, e registros de segurança (por exemplo, relógio do celular alterado).
5. Registros de acesso e de ciência deste termo (data e versão).
Esses dados são usados para cumprir o contrato de trabalho e as obrigações legais de controle de jornada, e protegidos conforme a Política de Privacidade. Meu CPF, CNH e telefone ficam criptografados no banco de dados e só são vistos por pessoas autorizadas da minha empresa. Estou ciente dos meus direitos (acesso, correção, informação, entre outros), que posso exercer na opção "Privacidade" do aplicativo. Não estou dando "consentimento" para este tratamento: ele é feito por obrigação legal e contrato de trabalho, e esta ciência serve para eu ser informado com transparência.`;

  return {
    versao: VERSAO_DOCUMENTOS,
    controlador: c
      ? { razaoSocial: c.razaoSocial, cnpj: c.cnpj }
      : null,
    encarregado: c?.encarregadoNome
      ? {
          nome: c.encarregadoNome,
          email: c.encarregadoEmail,
          telefone: c.encarregadoTelefone,
        }
      : null,
    documentos: [
      { tipo: 'POLITICA_PRIVACIDADE', titulo: 'Política de Privacidade', texto: politica },
      { tipo: 'TERMO_DADOS_PESSOAIS', titulo: 'Termo de ciência sobre dados pessoais', texto: termoDados },
      { tipo: 'TERMO_GPS', titulo: 'Termo de ciência sobre localização', texto: termoGps },
    ],
  };
}
