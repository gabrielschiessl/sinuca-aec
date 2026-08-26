# Testes e manutenção

## Situação atual

Não há suíte automatizada completa, gerenciador de pacotes ou CI. A qualidade
depende de verificações estáticas, testes controlados contra a API e validação
manual responsiva. Toda nova regra crítica deve, quando possível, ser isolada em
função testável e acompanhada por teste automatizado futuro.

## Verificações antes de entregar

### Repositório

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

### SQL

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
| Séries | três tabs; filtros combinados de rodada, jogador e pendentes; folga; cards em desktop/mobile |
| Histórico | ano padrão, A/B ausente, filtros sticky |
| Ranking | 5 anos, 30 posições, empate, W.O. direto, header sticky |
| Regra | três tabs, taxa dinâmica, responsividade <= 410 px |
| Login | autorizado, não autorizado, sessão restaurada, logout |
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
