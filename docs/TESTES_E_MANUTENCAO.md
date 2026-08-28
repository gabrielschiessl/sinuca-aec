# Testes e manutenção

## Situação atual

Não há suíte automatizada completa, gerenciador de pacotes ou CI. A qualidade
depende de verificações estáticas, testes controlados contra a API e validação
manual responsiva. Toda nova regra crítica deve, quando possível, ser isolada em
função testável e acompanhada por teste automatizado futuro.

## Verificações antes de entregar

### Repositório

Roteamento no cPanel: abrir `/sinuca-aec/placa` e um caminho inválido aninhado;
ambos devem terminar em `/sinuca-aec/`. Conferir `/serie-a`, `/placar/tv`, API
e arquivos estáticos existentes sem redirecionamento indevido; caminhos de API
ou assets inexistentes não devem virar HTML da Home. Conferir também o WordPress
fora de `/sinuca-aec/`, que não recebe regras novas.

```powershell
git status --short
git diff --check
git diff --stat
```

### JavaScript

Executar `node --check` em todos os `.js` e confirmar que cada import relativo
existe. Como não há bundler, erros aparecem somente em runtime se isso for
ignorado.

### PHP

Executar `php -l` em `api/index.php` e todos os arquivos de `api/src` em um
ambiente com PHP. A máquina de desenvolvimento pode não possuir PHP local; nesse
caso declarar a limitação e validar em QAS/servidor antes de produção.

### Salas do placar — testes adicionados

- `node tests/scoreboard-opening.mjs`: alternância independente do vencedor,
  Não definido/legado, troca de tacada e reset. Validar em iPhone/TV: selecionar
  cada jogador, finalizar duas partidas, desfazer, renomear e recarregar; conferir
  indicadores e transferência de sala. API deve persistir `firstStarter`.
  Nesta alteração os testes Node passaram; a verificação visual ficou pendente
  porque a conexão do navegador falhou ao iniciar. PHP não disponível localmente.

- `node tests/scoreboard-client.mjs`: passou em 27/08/2026. Transporte simulado:
  serialização, resposta perdida, recuperação após recarga, retry imutável,
  revogação, TV somente leitura, conflito, expiração e isolamento do storage local.
- Cliente também testa desfazer após resposta perdida/recarga, bloqueio durante
  confirmação e histórico vazio. PHP testa PIN com zero inicial, rejeição de
  não numéricos, código numérico e reutilização condicional de sala expirada.
  Testar no servidor uma reutilização concorrente e troca de controle durante
  expiração; PHP/MySQL ainda indisponíveis localmente para executar a suíte.
- Interface local conferida no navegador: abertura do modal e dimensões mobile.
  Botão Desfazer validado em 7 → 5 → 0, desabilitado ao acabar o histórico;
  campo de PIN conferido com inputmode numérico.
  Safari/iPhone, TV real e integração PHP/MySQL ainda precisam de validação.
- Teste manual: criar pelo telefone, abrir Link da TV, somar pontos e trocar
  tacada; na TV em sala, confirmar ausência da legenda de atalhos, `/` sem
  efeito, logo sem navegação e somente controles da sala disponíveis;
  conferir identificadores ampliados em 1280×720 e 1920×1080. Depois trocar
  tacada; assumir com senha em outro telefone; o anterior deve ser bloqueado.
  Desligar/religar rede durante escrita e recarregar sem duplicar pontos.
  Criar segunda sala, verificar isolamento, sair e conferir placar local anterior.

- `php tests/scoreboard-state.php`: validação pura, sem acesso a banco.
- `php tests/scoreboard-rooms.php`: integração somente em banco descartável com
  001 + 005 + 006. A variável `AEC_SCOREBOARD_TEST_CONFIG` deve apontar para um
  PHP privado retornando `database` e `scoreboard_test_database => true`.
  Nunca apontar para produção. O teste cria duas salas e remove somente essas
  salas e seus buckets individuais; buckets globais de limite permanecem.
- Casos: transferência, token revogado, senha errada, consulta sem segredos,
  comandos repetidos, conflitos, isolamento, encerramento, expiração e limites.
- Esses testes ainda não foram executados nesta etapa por ausência de PHP/MySQL
  local. Rodar também `php -l` nos três arquivos novos antes do teste integrado.
- Testar concorrência real no servidor: duas escritas na mesma versão (somente
  uma deve vencer) e transferência durante escrita (token antigo deve ser
  recusado após a transferência). O teste CLI sequencial não cobre essa corrida.

### Verificações SQL

- importar em banco descartável/QAS;
- conferir `schema_migrations`;
- validar contagens antes/depois;
- testar rollback ou restauração.

### Documentos

- XLSX: abrir no Excel, conferir impressão, margens, orientação, áreas,
  mesclagens, imagens, número dinâmico de participantes e casos ímpares.
- DOCX: abrir no Word, conferir imagens, numeração, ano, taxa e datas.
- Testar manual e atualizada, A e B, temporada ativa e histórica aplicável.

## Matriz mínima de regressão

| Área | Casos mínimos |
|---|---|
| Home | ano imediato, navegação e scroll no topo; botão de retorno ao topo ausente |
| Navegação | botão flutuante após rolagem nas rotas internas, retorno suave e safe area do iPhone |
| Séries | três tabs; filtros combinados; folga; dica lateral sempre em Resultados e na Classificação somente <= 388 px; tabelas arrastáveis com mouse |
| Histórico | ano padrão, A/B ausente, filtros sticky; dica lateral sempre em Resultados e na Classificação somente <= 388 px; tabelas arrastáveis com mouse |
| Ranking | 5 anos, 30 posições, empate, W.O. direto, header sticky; dica lateral fixa no card somente em touch <= 907 px; tabela arrastável com mouse |
| Placar | último botão da Home abre `/placar`; primeiro modal de nomes retorna a página ao topo ao confirmar ou cancelar; sem administrador; cards compactos somente leitura; seta da tacada à esquerda do nome sem desalinhamento; pontuação única; troca e falta; ferramentas separadas de reinício/finalização com confirmação; modal unificado de bolas, mesa, regra rápida e diferenças máximas; botão final `Modo TV`; nomes; diferença; finalização do jogo; histórico e persistência local; SVGs; Wake Lock ativo, retorno do segundo plano e fallback sem suporte; 760, 600, 380 e 320 px |
| Placar TV | rota direta sem menus; layout 16:9; sem administrador ou controles clicáveis; tacada ativa e sua pontuação; falta fora da tacada; teclas 0–9, ponto, *, +, -, Backspace, Enter e /; edição de nomes; ajuda; reset parcial/completo e desfazer; estado compartilhado; Wake Lock |
| Regra | três tabs, taxa dinâmica, responsividade <= 410 px |
| Login | autorizado, não autorizado, sessão restaurada, logout; popup no navegador e redirect no PWA/iPhone |
| Partidas | 2x0, 2x1, ao vivo, data em qualquer dia, salvar tudo; filtros combinados de rodada, jogador e pendentes |
| W.O. | esquerda, direita, ambos, observações e ranking |
| Participantes | troca, duplicidade, desempate, W.O., Safari sem zoom |
| Jogadores | novo, edição, ativação/inativação protegida |
| Nova temporada | sugestão, importação parcial, ímpar, rascunho, ativação |
| Histórica | A somente, A+B, Wx0, WxW, edição após publicação |
| Planilhas | cada grupo, manual/atualizada, A/B, DOCX simultâneo |
| PWA | manifesto, SW ativo, instalação Android, adicionar à Home no iPhone |

### Regressão específica da ativação

Executar primeiro em banco/planilha descartável:

1. tentar ativar ano diferente de `temporada_atual + 1` e confirmar rejeição;
2. tentar ativar sem agenda completa e confirmar que nenhum status mudou;
3. ativar rascunho válido e conferir temporada anterior `ARQUIVADA`, nova
   `ATIVA`, configuração atualizada e jogadores sincronizados;
4. no MySQL, conferir `audit_log`, `data_versions` e ausência de estado parcial;
5. repetir o contrato com `?api=appscript`, conferindo as abas de configuração,
   temporadas, participantes e rodadas;
6. testar todas as ações listadas em `API.md` nos dois backends, incluindo
   ranking, taxa, referência, dados XLSX e DOCX.

## Breakpoints e navegadores

O projeto possui ajustes específicos próximos de 480, 440, 415, 410, 380 e
365 px. Não generalize uma correção mobile sem verificar os seletores: várias
mudanças foram deliberadamente restritas a uma única tela.

Validar no mínimo:

- Chrome desktop;
- viewport 720, 480, 440, 410, 380, 365 e 320 px;
- Safari em iPhone real;
- campos `date`, `time`, `number`, selects e modais nativos do iOS.

Inputs focáveis no iOS devem ter fonte de pelo menos 16 px para evitar zoom.

### Regressão específica da PWA

1. Abrir `/sinuca-aec/manifest.webmanifest` e confirmar JSON, ícones e escopo.
2. Confirmar que todos os cinco PNGs de `assets/icons/` respondem com 200.
3. Em DevTools > Application, confirmar manifesto válido e service worker ativo.
4. Navegar online pelas rotas e confirmar ausência de respostas antigas.
5. Confirmar no Network que `/api/` continua vindo da rede e não do SW.
6. Simular offline e confirmar que o casco da Home abre, aceitando que dados da
   API, login e bibliotecas CDN não possuem garantia offline.
7. Instalar no Android/desktop e confirmar modo standalone e ícone.
8. Adicionar à Tela de Início no Safari/iPhone e confirmar ícone e abertura.
9. Pelo ícone instalado no iPhone, entrar em Administrador, selecionar a conta
   Google, confirmar retorno autenticado à mesma PWA e restauração após fechá-la.

## Teste seguro de escrita

1. Confirmar visualmente qual backend está selecionado.
2. Usar banco/planilha QAS ou registro descartável autorizado.
3. Anotar estado anterior.
4. Executar uma única mutação.
5. Conferir UI, resposta da API, banco e `audit_log`.
6. Reverter pelo fluxo normal ou restaurar o registro.
7. Só então ampliar o teste.

## Manutenção de documentação

| Mudança | Documentos a revisar |
|---|---|
| Regra esportiva | `VISAO_FUNCIONAL`, `FLUXOS_BPM`, `CONTEXTO_IA` |
| Endpoint/payload | `API`, `ARQUITETURA`, `CONTEXTO_IA` |
| Tabela/migração | `BANCO_DE_DADOS`, `OPERACAO_E_DEPLOY` |
| Rota/componente | `ARQUITETURA`, matriz de regressão |
| Deploy/configuração | `OPERACAO_E_DEPLOY`, README raiz |
| Planilha/DOCX | `VISAO_FUNCIONAL`, testes de documentos |
| Decisão/limitação | `DECISOES_E_PENDENCIAS`, `CONTEXTO_IA` |

## Política de limpeza

- Provar ausência de referência antes de remover arquivo.
- Considerar referências dinâmicas e consumo externo.
- Não remover migrações já aplicadas; elas documentam evolução do banco.
- Não remover o backend QAS enquanto `?api=appscript` for suportado.
- Assets binários devem ser removidos apenas com alvo explícito e recuperação
  pelo Git conhecida.
