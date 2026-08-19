# Visão funcional e regras de negócio

## Atores

- **Visitante:** consulta temporada atual, histórico, regra, regulamento e ranking.
- **Administrador:** realiza todas as consultas e, após autenticação e ativação
  do modo edição, altera dados do campeonato.
- **Google:** comprova a identidade da conta administrativa.
- **Organização do campeonato:** define participantes, datas, resultados,
  desempates, taxa, temporada e documentos impressos.

## Conceitos

- **Jogador:** cadastro global, independente de ano e divisão.
- **Participante:** vínculo de um jogador a um número, divisão e temporada.
- **Temporada:** edição anual com status e origem.
- **Divisão:** Série A ou Série B existente naquela temporada.
- **Rodada:** conjunto numerado de partidas e possível folga.
- **Partida:** confronto entre dois participantes, com agenda, status e placar.
- **Jogo/partida singular vencida:** cada ponto do placar de 0 a 2.
- **Vitória:** vencer o confronto, normalmente alcançando 2 no placar.

## Ciclo de temporada

| Estado | Significado | Visível publicamente |
|---|---|---|
| `PREPARACAO` | Rascunho de nova temporada ou histórica | Não |
| `ATIVA` | Temporada vigente | Sim |
| `ARQUIVADA` | Temporada encerrada/histórica | Sim |

| Origem | Significado |
|---|---|
| `CRIADA` | Criada pelo fluxo de nova temporada |
| `LEGADA` | Cadastrada como temporada passada |

Ao ativar uma nova temporada, a atual deve ser arquivada e a configuração
`temporada_atual` deve apontar para o novo ano. Essa operação precisa ser
atômica e auditada.

## Participantes e chaveamento

### Nova temporada

- A: exatamente 20 participantes.
- B: pelo menos 2 participantes.
- Um jogador não ocupa duas vagas na mesma temporada.
- Sugestão inicial: 16 primeiros da A + 4 primeiros da B formam a nova A; os
  demais da B + 4 últimos da A formam a nova B.
- Sem sorteio, copia-se o chaveamento atual quando a quantidade é compatível;
  caso contrário gera-se todos contra todos.
- O administrador pode editar, importar ou simular novo chaveamento antes de
  salvar o rascunho.

### Temporada histórica

- A obrigatória com pelo menos 2 jogadores; não exige 20 nem quantidade par.
- B opcional; quando informada, exige pelo menos 2 jogadores.
- Importação é o caminho principal, mas os dados ficam revisáveis no editor.
- Temporadas históricas publicadas (`ARQUIVADA` + `LEGADA`) continuam editáveis.

### Todos contra todos

- Quantidade par: `N - 1` rodadas e `N / 2` partidas por rodada.
- Quantidade ímpar: `N` rodadas, `(N - 1) / 2` partidas e uma folga por rodada.
- Cada par de participantes se enfrenta uma única vez.
- Ninguém aparece duas vezes na mesma rodada.

## Agenda

- Datas podem ser alteradas para qualquer dia da semana.
- Ao informar a primeira rodada de uma nova temporada, o sistema distribui as
  seguintes entre terças e quintas:
  - primeira rodada na terça ou quarta: próxima data automática é quinta;
  - primeira rodada de quinta a segunda: próxima data automática é terça.
- Após o preenchimento, toda data permanece editável manualmente.
- Horário padrão inicial: 19:00.
- Data/hora da partida pode sobrescrever a data/hora da rodada.

## Estados e placares

| Código | Estado | Regra |
|---|---|---|
| `A` | Agendado | Sem placar |
| `V` | Em andamento | Ambos preenchidos, sem 2 pontos |
| `E` | Encerrado | Um vencedor com 2, ou exceção de W.O. duplo 0 x 0 |

Ao colocar 2 para um jogador, a partida é encerrada automaticamente.

### W.O.

- W.O. no lado de um jogador significa que esse jogador perdeu.
- Resultado persistido: adversário 2, perdedor 0.
- Observação: `W.O.: Nome do perdedor`.
- W.O. para ambos: resultado 0 x 0 e observação
  `W.O.: ambos abandonaram a competição`.
- Importação reconhece `Wx0`/`0xW` como W.O. individual e `WxW` como duplo.
- Na exportação visual, W.O. é mostrado como `W x 0`, `0 x W` ou `W x W`.

### W.O. direto do participante

A checkbox `W.O.` no participante representa abandono/não participação direta:

- jogos pendentes ou registrados são convertidos em derrota por W.O.;
- se o adversário também estiver marcado, o confronto vira W.O. duplo;
- a classificação coloca esse participante abaixo de outro empatado sem W.O.;
- a participação rende 0 ponto no ranking, mas a posição do torneio continua
  registrada.

## Classificação

Ordem aplicada pelo backend:

1. maior número de vitórias;
2. maior número de partidas singulares vencidas;
3. participante sem W.O. direto;
4. menor `tiebreak_priority`, quando informado;
5. vencedor do confronto direto, se já ocorreu;
6. menor número do participante.

O desempate manual não aparece ao público; serve para decisões da organização
que não podem ser inferidas automaticamente.

## Ranking geral

- Somente participações na Série A.
- Janela móvel de cinco anos terminando na referência configurada.
- A referência automática é o ano anterior à temporada vigente.
- O administrador pode antecipar a referência para incluir a temporada atual já
  encerrada antes de ativar a próxima.
- Em uma Série A com `N` participantes, a posição 1 recebe `N` pontos, a 2 recebe
  `N-1`, até a última receber 1.
- W.O. direto rende 0, exibido como 0 (não traço) naquele ano.
- Máximo de 30 nomes.
- Empate: posição no ranking anterior; depois nome de exibição; depois ID.

## Histórico

- Lista apenas temporadas `ATIVA` ou `ARQUIVADA`, mas a interface seleciona
  temporadas passadas para consulta histórica.
- Ao entrar, deve preferir a temporada imediatamente anterior à atual.
- Se uma divisão não existir, exibe mensagem explícita.
- Rodadas e jogador podem ser filtrados; classificação e matriz de resultados
  usam os mesmos componentes da temporada atual.

## Documentos

### Planilha manual

Destinada ao preenchimento a caneta. Não inclui dados finais que não podem ser
preenchidos/ordenados manualmente. Resultados coloridos ficam vazios.

### Planilha atualizada

Reflete o banco no momento da geração e inclui classificações, resultados,
ranking quando aplicável e fichas preenchidas.

### Regulamento DOCX

Disponível em qualquer divisão e tipo de planilha. É gerado separadamente no
mesmo clique, usando o modelo de `api/templates`.
