# Arquitetura futura do Sistema AEC Sinuca

## Princípio central

Jogadores, participantes, chaveamento, rodadas e placares formam a fonte única
de dados. Site, classificação, dashboards, cartilhas e materiais de impressão
são projeções geradas a partir dessa fonte.

## Gestão de temporadas

- A Série A possui 20 participantes e chaveamento padrão fixo.
- O chaveamento da Série A pode ser editado excepcionalmente.
- A Série B aceita qualquer quantidade de participantes.
- Uma temporada associa cada número competitivo a um jogador.
- Alterar o jogador de um número atualiza nomes em todas as projeções sem
  alterar o chaveamento baseado em números.

## Autenticação e área administrativa

As páginas públicas permanecem sempre em modo de visualização, mesmo quando há
uma sessão administrativa salva no dispositivo. Controles de escrita não devem
ser misturados aos cards, filtros e tabelas utilizados pelo público.

O acesso administrativo ocorrerá em `/administrador`, com navegação explícita
a partir do botão da navbar. Dentro dessa área haverá dois estados:

1. Visualização e conferência da temporada.
2. Modo de edição ativado deliberadamente pelo administrador.

Entrar no modo de edição não concede autoridade por si só. Toda leitura privada
e toda gravação devem validar a sessão no Apps Script.

### Persistência da sessão

- A senha nunca será armazenada no navegador.
- O dispositivo armazena somente um token opaco de sessão.
- A API associa o token ao administrador, validade, último uso e revogação.
- A sessão pode ser lembrada por um período configurável, sugerido em 30 dias.
- Refresh, fechamento da aba e reinício do navegador preservam a sessão.
- Sair remove o token local e revoga a sessão no servidor.
- Sessões poderão ser revogadas individualmente em caso de perda de dispositivo.
- Toda operação de escrita valida novamente o token no servidor.

O estado salvo no navegador serve apenas para conveniência visual. Nunca deve
ser usado como prova suficiente de autorização.

### Opções de identidade

Opção recomendada: login com conta Google e lista de e-mails administradores.
Ela evita administrar senhas próprias, mas exige configurar um cliente OAuth
para o domínio do GitHub Pages.

Alternativa: credencial própria validada pelo Apps Script, que emite um token de
sessão revogável. Essa opção é mais simples para poucos administradores, mas
exige política de senha, recuperação e proteção contra tentativas repetidas.

### Confirmação de escrita

- Alterações são preparadas como rascunho local.
- O administrador vê uma prévia e o impacto antes/depois.
- Somente a confirmação envia a mutação à API.
- A API valida sessão, regras de negócio e versão dos dados.
- Conflitos de versão impedem sobrescrever alterações mais recentes.
- Depois de gravar, a API devolve o novo estado consolidado e sua versão.

## Modos de chaveamento

O administrador poderá escolher entre:

1. Reutilizar o chaveamento padrão da divisão.
2. Inserir ou editar manualmente rodadas e confrontos.
3. Gerar automaticamente um turno de todos contra todos.
4. Sortear números ou confrontos e visualizar uma simulação.

Uma simulação não altera dados. A confirmação deve validar e apresentar o
antes/depois antes de substituir o chaveamento.

### Validações

- Um jogador participa no máximo uma vez por rodada.
- Um confronto não pode ser duplicado no mesmo turno.
- Todos os participantes devem se enfrentar uma vez no todos contra todos.
- Quantidade par: `participantes - 1` rodadas.
- Quantidade ímpar: `participantes` rodadas, com uma folga por rodada.
- Chaveamentos com placares existentes não podem ser substituídos sem um fluxo
  explícito de migração e confirmação.

## Confirmação e atualização do banco

Operações administrativas devem seguir este fluxo:

1. Validar a alteração.
2. Exibir uma prévia.
3. Solicitar confirmação.
4. Obter bloqueio de escrita para impedir alterações concorrentes.
5. Registrar uma cópia/versionamento do estado anterior.
6. Atualizar as tabelas-base.
7. Incrementar a versão global dos dados.
8. Regenerar estatísticas e materiais derivados.
9. Retornar ao administrador o novo estado consolidado.

As ações devem registrar data, usuário, operação e versão para auditoria.

## Projeções automáticas

Após uma alteração confirmada, o sistema deve atualizar:

- rodadas e confrontos da API;
- resultados por jogador e rodada;
- vitórias e partidas singulares vencidas;
- classificação e zonas de acesso/rebaixamento;
- planilhas visuais preenchidas;
- planilhas em branco para impressão;
- cartilhas agrupadas por rodadas;
- site público e painel administrativo.

## Próximas entregas

1. Cadastro manual de temporadas históricas, com participantes, chaveamento,
   datas, horários, placares e resultados.
2. Importação opcional por planilha para temporadas históricas e para os fluxos
   equivalentes da temporada atual, sempre com validação e prévia antes de
   gravar.
3. Edição administrativa de partidas, datas e horários das rodadas da temporada
   atual.
4. **Ranking geral do campeonato**, iniciado somente depois da conclusão e
   validação dos três itens anteriores. Os critérios e a apresentação do ranking
   serão definidos com o responsável pelo projeto antes da implementação.

### Regras preliminares do ranking

- O ranking exibirá no máximo 30 jogadores.
- A pontuação considerará somente as cinco temporadas mais recentes.
- Somente participações na Série A gerarão pontos.
- Um jogador poderá permanecer entre os 30 mesmo sem disputar a Série A em uma
  das cinco temporadas; nessa temporada específica ele apenas receberá zero
  ponto.
- Os pesos e critérios exatos de pontuação serão definidos antes da
  implementação.

### Modelo para importação por planilha

- A importação será uma alternativa ao preenchimento manual, não uma etapa
  obrigatória.
- Ao escolher “Importar planilha”, o administrador verá as orientações e um
  botão para baixar um arquivo `.xlsx` de exemplo.
- O modelo terá abas, cabeçalhos, formatos e exemplos compatíveis exatamente
  com o cadastro manual de participantes, rodadas, partidas e resultados.
- O arquivo será versionado com o site e disponibilizado para download direto,
  evitando dependência de permissões ou disponibilidade do Google Drive.
- Antes da gravação, o sistema exibirá uma prévia, apontará linhas inválidas e
  exigirá confirmação explícita.
- A definição final dos cabeçalhos ocorrerá depois que o formato do cadastro
  manual estiver consolidado, para impedir divergência entre os dois fluxos.

## Atualização automática do site

O site é estático no GitHub Pages e a API usa Apps Script. Essa arquitetura não
oferece WebSocket nativo. A atualização será feita por sincronização baseada em
versão:

1. A API expõe uma versão global e `atualizado_em`.
2. O navegador consulta somente essa versão em intervalo curto.
3. Rodadas e estatísticas são buscadas novamente apenas quando a versão mudar.
4. A aba em segundo plano pausa as consultas.
5. Ao voltar ao site, a verificação ocorre imediatamente.
6. O administrador recebe o estado atualizado assim que uma gravação termina.

### Diretrizes mobile

- Intervalo inicial sugerido: 20 a 30 segundos com a página visível.
- Pausar quando `document.visibilityState` não for `visible`.
- Sincronizar imediatamente em `visibilitychange`, `focus` e reconexão.
- Manter os dados atuais na tela enquanto busca a nova versão.
- Mostrar discretamente “Atualizado agora” ou horário da última sincronização.
- Oferecer atualização manual como alternativa, sem exigir que o usuário saiba
  recarregar a página.
- Evitar recarregar HTML, CSS, imagens ou dados inalterados.

Esse modelo reduz consumo de bateria e internet e mantém a experiência próxima
de tempo real para usuários mobile. Caso seja necessário tempo real em segundos
no futuro, poderá ser adotado um serviço com WebSocket/SSE sem alterar o motor
de estatísticas ou as projeções.
