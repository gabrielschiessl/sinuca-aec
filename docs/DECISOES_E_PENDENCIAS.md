# Decisões, histórico técnico e pendências

Este arquivo registra o motivo das decisões que não são óbvias apenas pelo
código e mantém pendências reais visíveis. Use datas absolutas.

## Decisões vigentes

### 2026-08-27 — Salas de placar exclusivas do PHP/MySQL

Autorizado pelo usuário não implementar salas em Apps Script, inclusive na
versão final. O placar local permanece disponível; o modo compartilhado terá
salas independentes, um controlador e TVs visualizadoras, sem login de ADM ou
escritas nas partidas oficiais. Implementação em etapas, descrita em
`PLACAR_COMPARTILHADO.md`. A migração 005 foi confirmada pelo usuário; 006 e
API estão implementadas e aguardam envio/validação. A transferência por senha
revoga o token anterior atomicamente; não requer conta Google. Prazo padrão
de teste: 24 horas renovadas por escrita/transferência, configurável.

### 2026-08 — PHP/MySQL como produção

O sistema deixou de usar Apps Script/Sheets como backend principal. PHP 8.3 e
MySQL na HostGator são o padrão por desempenho, índices, transações, auditoria e
controle do volume histórico. Apps Script permanece como QAS opcional.

### 2026-08 — URL amigável sob subdiretório

A aplicação vive em `/sinuca-aec`. Pastas por rota e `404.html` restauram a SPA
sem depender de alterar a configuração global do WordPress.

### 2026-08 — Histórico editável

Temporadas `ARQUIVADA` de origem `LEGADA` podem ser reabertas no editor para
corrigir ou acrescentar uma divisão. Não é necessário despublicar o restante.

### 2026-08 — Importação como entrada de histórico

Temporadas antigas são preferencialmente importadas por planilha, revisadas no
editor e salvas como rascunho antes da publicação. Série B é opcional.

### 2026-08 — Datas livres, automação terça/quinta

Nenhuma data é proibida por dia da semana. Terça/quinta é somente a regra de
preenchimento automático das rodadas futuras de uma nova temporada.

### 2026-08 — W.O. em dois níveis

Há W.O. de uma partida e W.O. direto de participante. O segundo transforma os
confrontos e zera a pontuação do ano no ranking. W.O. duplo é 0 x 0 no banco e
W x W nos materiais.

### 2026-08 — Ranking móvel

O ranking usa cinco Séries A, no máximo 30 jogadores e pontuação proporcional
ao número de participantes. A referência pode ser antecipada pelo administrador.

### 2026-08 — XLSX no cliente e DOCX no servidor

Planilhas são construídas no navegador com ExcelJS para permitir seleção de
folhas. O regulamento é gerado no PHP porque exige manipular um modelo DOCX. A
geração genérica de PDF foi removida por não preservar adequadamente paginação
e impressão.

### 2026-08-19 — Documentação como parte do produto

Toda alteração relevante deve atualizar `docs/` no mesmo trabalho. O arquivo
`AGENTS.md` orienta futuras IAs a ler e manter essa documentação.

### 2026-08-19 — Ativação transacional e QAS com paridade de contrato

`ativar_temporada` foi implementada no PHP com bloqueio, validações, troca de
status/configuração, sincronização, auditoria, versionamento e rollback único.
O Apps Script passou a expor todas as ações usadas pelo frontend, inclusive
ranking, configurações, edição vigente, dados de planilha e DOCX. MySQL mantém a
garantia ACID; Sheets mantém `ScriptLock` e coordenação multiaba.

### 2026-08-21 — Site instalável como PWA sem promoção própria

O site passou a fornecer manifesto, ícones e service worker para instalação em
navegadores compatíveis. Não há botão ou modal de instalação no frontend: a
promoção fica a cargo do navegador. O service worker adota rede primeiro e não
intercepta a API, preservando atualizações frequentes e dados administrativos.

## Pendências prioritárias

### P1 — Testes automatizados

Criar testes para `StatisticsCalculator`, ranking, todos-contra-todos, W.O.,
validação de payload e geração de documentos. Depois adicionar CI.

### P2 — Migrações idempotentes

002 e 004 falham se reaplicadas. Novas migrações devem consultar a estrutura ou
ser aplicadas por runner que respeite `schema_migrations`.

### P2 — Dependências CDN

ExcelJS e SheetJS são carregados sob demanda pela internet. Avaliar vendorização
ou fallback local para operação sem CDN.

### P3 — Assets órfãos

Foram identificadas variantes antigas de logos/escudos e PNGs duplicados das
bolas sem referência textual. Permanecem no repositório até confirmação explícita
para exclusão.

## Itens deliberadamente fora do escopo atual

- edição ao vivo por múltiplos administradores em tempo real;
- WebSocket/SSE;
- aplicativo nativo;
- geração de PDF universal das planilhas;
- remoção do backend Apps Script.

## Como registrar nova decisão

### 27/08/2026 — Controle numérico e reversão

Por facilidade de digitação na TV, códigos novos têm seis números e PIN quatro.
PIN curto exige limites por IP e sala; não usar como autenticação pessoal.
Códigos expirados podem ser reutilizados, revogando credenciais antigas e sem
reiniciar versão. Schema existente é suficiente. Adicionado Desfazer por estado
confirmado em `/placar`, sem permitir reversões do antigo controlador após troca.

### 27/08/2026 — Interface de salas

Salas opcionais preservam o placar local. Token e comando pendente ficam em
sessionStorage, nunca em links; senha permite recuperar/transferir controle.
TV conectada a sala é somente visualizadora. Polling de 2s com recuo e uma
escrita por vez evita duplicação; sem confirmação não há nova pontuação.
Cliente testado com transporte simulado; testes MySQL e Safari/TV continuam
pendentes. Reversão operacional: usar `/placar` sem `?sala=` (modo local).

Inclua data, contexto, decisão, alternativas rejeitadas, consequências e, se
aplicável, plano de reversão. Não apague decisões antigas: marque-as como
substituídas e aponte para a nova.
