# Importação e documentos gerados

## Modelo de importação

Arquivo oficial: `assets/templates/modelo-temporada-historica.xlsx`.

### Aba `Instrucoes`

Orienta ano, limites de participantes, IDs, numeração, confrontos, folgas,
datas/horas e W.O. Não transformar a folga em uma partida: em divisão ímpar, o
participante ausente dos confrontos da rodada é identificado como folga.

### Aba `Participantes`

Cabeçalhos exatos e obrigatórios:

| Coluna | Tipo | Regra |
|---|---|---|
| `divisao` | texto | A ou B |
| `numero` | inteiro | Sequencial a partir de 1 por divisão |
| `jogador_id` | inteiro | ID existente no sistema |
| `jogador` | texto | Conferência humana; resolução principal pelo ID |

### Aba `Partidas`

Cabeçalhos exatos:

| Coluna | Tipo/formato | Regra |
|---|---|---|
| `divisao` | texto | A ou B |
| `rodada` | inteiro | Número regular |
| `numero1` | inteiro | Número do primeiro participante |
| `numero2` | inteiro | Número do segundo participante |
| `data` | `dd/mm/aaaa` | Qualquer dia da semana |
| `hora` | `HH:mm` | Horário da partida |
| `placar1` | placar | 0, 1, 2 ou W conforme par |
| `placar2` | placar | 0, 1, 2 ou W conforme par |

Resultados normais: 2 x 0 ou 2 x 1. W.O.: `W x 0`, `0 x W` ou `W x W`;
variantes `WO` e `W.O.` são normalizadas. Placares podem ficar vazios em nova
temporada/rascunho.

## Processo de importação

1. O navegador carrega SheetJS sob demanda.
2. Confere nomes das abas e cabeçalhos.
3. Normaliza texto, data, hora e placares.
4. Resolve jogadores e valida números/divisões.
5. Reconstrói rodadas e detecta folgas.
6. Preenche somente as séries importadas no editor.
7. O administrador revisa antes de salvar.
8. A persistência ocorre apenas em `Salvar rascunho`/ação equivalente.

## Geração de XLSX

Arquivo: `js/utils/championshipSpreadsheet.js`. Biblioteca: ExcelJS 4.4.0.

Configuração comum de impressão:

- papel A4;
- ajuste para uma página de largura;
- grade oculta;
- centralização horizontal;
- margens: 0,2 pol. esquerda/direita (0,508 cm) e 0,25 pol. superior/inferior
  (0,635 cm), cabeçalho/rodapé zero.

### Disponibilidade por versão

| Folha/grupo | Manual | Atualizada | Restrição |
|---|---:|---:|---|
| Jogadores | Sim | Sim | A/B |
| Ficha de inscrição | Sim | Sim | A/B |
| Classificação simples | Não | Sim | A/B |
| Classificação | Não | Sim | A/B |
| Vitórias | Sim, sem pintura | Sim | A/B |
| Resultados | Não | Sim | A/B |
| Partidas vencidas | Sim, sem pintura | Sim | A/B |
| Ranking | Não | Sim | somente Série A |
| Rodadas | Sim, placar vazio | Sim | A/B |
| Fichas individuais | Sim, resultados vazios | Sim | A/B |

Temporadas históricas são normalmente exportadas apenas na versão atualizada,
mas a interface deve respeitar as opções habilitadas pelo estado atual.

### Jogadores

- Retrato, logos AEC e escudo.
- Título com divisão e ano.
- Ordem do número inicial do campeonato.
- Quantidade de linhas igual à de participantes.
- Nomes em maiúsculas.

### Ficha de inscrição

- Retrato, logos preservadas.
- Divisão, ano e taxa parametrizados.
- Tabela com número, jogador, cota, telefone e forma de pagamento.
- Fonte interna 12.
- Somente a quantidade real de participantes.

### Classificação simples

- Retrato e somente atualizada.
- Série A: três primeiros verdes e quatro últimos vermelhos.
- Série B: quatro primeiros verdes e nenhum vermelho.

### Classificação

- Paisagem e somente atualizada.
- Ordenada pela classificação, mas também exibe número do participante.
- Mantém uma coluna por rodada, mesmo que vazia.
- Pinta a quantidade total de vitórias, não as rodadas específicas.
- Exibe vitórias e partidas singulares vencidas.
- Rodapé lista quatro promovidos da B e quatro rebaixados da A; bordas apenas no
  contorno horizontal de cada linha, não entre células internas.

### Vitórias

- Paisagem, ordem pelo número do participante.
- Uma coluna por rodada.
- Atualizada pinta a quantidade de vitórias: zona superior em verde, demais em
  amarelo; não usa vermelho para rebaixamento.
- Manual mantém os quadrinhos sem pintura.

### Resultados

- Paisagem e somente atualizada.
- Ordem pelo número do participante.
- Vitória verde, derrota vermelha e partida pendente cinza claro.
- W.O. duplo conta como derrota para ambos.

### Partidas vencidas

- Paisagem, ordem pelo número do participante.
- Total máximo de colunas: `rodadas * 2`.
- Atualizada pinta em verde a quantidade de partidas singulares vencidas.
- Manual não pinta.

### Folhas de rodadas

- Paisagem, quatro rodadas por folha em grade 2 x 2.
- Última folha deixa blocos inexistentes totalmente vazios e sem bordas.
- Cabeçalho da rodada: ordinal, data, hora e dia da semana em maiúsculas.
- Preserva números e lado dos participantes do chaveamento.
- Área interna de confrontos mantém altura total constante; linhas aumentam
  proporcionalmente quando há menos partidas.
- Folga aparece no rodapé como `Folga: NomeJogador`.
- Manual e partida pendente deixam placares vazios.
- Atualizada converte W.O. para W/0 ou W/W visualmente.

### Fichas individuais

- Retrato, quatro jogadores por folha.
- Blocos faltantes na última página ficam vazios, sem redimensionar os demais.
- Identificação: `NÚMERO - NOME`, sem ordinal, nome em maiúsculas.
- Cada rodada ocupa três linhas: data, resultado, adversário.
- Placar sempre é exibido da perspectiva do jogador da ficha.
- Vitória na primeira coluna, derrota na segunda; cores verde e laranja/rosado.
- Manual deixa dados internos de resultado vazios.

### Ranking

- Paisagem, somente atualizada/Série A.
- Ordem pelo ranking anterior de cinco anos.
- Inclui colocação no torneio, jogador, jogos, vitórias, derrotas, aproveitamento,
  pontos anteriores, pontos ganhos por ano, total e nova colocação.
- Ano atual da apuração destacado em amarelo.
- Participante com W.O. direto: 0 jogos/vitórias, todas derrotas e APR `W.O.`.
- Rodapé inclui legenda e nota dos quatro rebaixados.

## Regulamento DOCX

- Modelo: `api/templates/regulamento-aec.docx`.
- Gerador: `api/src/RegulationDocumentGenerator.php`.
- No QAS, `appsscript/paridade_api.gs` usa o mesmo modelo via URL pública ou
  `REGULATION_TEMPLATE_FILE_ID` e aplica os mesmos parâmetros/numeração.
- Parâmetros: ano, taxa em número e por extenso, primeira e última data entre as
  divisões existentes.
- Em produção requer PHP ZIP e DOM; no QAS requer autorização de `UrlFetchApp`
  ou acesso ao arquivo configurado no Drive.
- Retorno: nome, MIME e conteúdo base64.
- Quando XLSX e regulamento estão selecionados, o mesmo clique inicia dois
  downloads separados.

## Alterações futuras

Ao alterar folha, cabeçalho ou parser:

1. atualizar modelo e código juntos;
2. testar A/B, par/ímpar, manual/atualizada e W.O.;
3. abrir no Excel e conferir impressão;
4. atualizar este documento e a matriz de testes.
