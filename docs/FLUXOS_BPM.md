# Fluxos BPM

Os diagramas representam o comportamento desejado e os pontos de persistência.
Pendências técnicas conhecidas estão em `DECISOES_E_PENDENCIAS.md`.

## Consulta pública

```mermaid
flowchart TD
  A["Usuário acessa uma rota"] --> B["SPA renderiza estrutura e loading"]
  B --> C{"Dados estão no cache por menos de 60 s?"}
  C -- Sim --> D["Renderiza dados em cache"]
  C -- Não --> E["GET na API selecionada"]
  E --> F{"Resposta válida?"}
  F -- Sim --> G["Atualiza cache e renderiza"]
  F -- Não --> H["Exibe estado de erro e tentar novamente"]
  D --> I["Usuário filtra ou troca aba"]
  G --> I
  I --> J["Reposiciona scroll no topo quando aplicável"]
```

## Login e entrada no modo edição

```mermaid
flowchart TD
  A["Abrir /administrador"] --> B{"Sessão no localStorage?"}
  B -- Não --> C["Exibir Google Sign-In"]
  B -- Sim --> D["validar_sessao"]
  C --> E["login_google"]
  D --> F{"Sessão válida?"}
  E --> F
  F -- Não --> C
  F -- Sim --> G["Painel em modo visualização"]
  G --> H["Administrador clica Ativar edição"]
  H --> I["Controles de escrita habilitados"]
```

## Alterar partidas da temporada atual

```mermaid
flowchart TD
  A["Selecionar divisão"] --> B["Carregar partidas e filtros"]
  B --> C["Editar datas, horário, status, placar, W.O. ou observação"]
  C --> D["Marcar cards/rodadas pendentes"]
  D --> E["Salvar tudo"]
  E --> F["Validar estado de cada partida no frontend"]
  F --> G{"Confirmação do administrador"}
  G -- Cancela --> C
  G -- Confirma --> H["POST salvar_partidas + salvar_datas_rodadas"]
  H --> I["API autentica e abre transação"]
  I --> J["Valida confronto, placar e versão"]
  J --> K{"Tudo válido?"}
  K -- Não --> L["Rollback e modal de erro"]
  K -- Sim --> M["Atualiza banco, auditoria e data_versions"]
  M --> N["Commit, limpa cache e recarrega dados"]
```

## Cadastrar nova temporada

```mermaid
flowchart TD
  A["Escolher ano futuro"] --> B["Gerar sugestão de participantes"]
  B --> C["Copiar chaveamento compatível ou gerar todos contra todos"]
  C --> D{"Importar planilha opcional?"}
  D -- Sim --> E["Normalizar e preencher séries importadas"]
  D -- Não --> F["Manter sugestão"]
  E --> G["Revisar participantes, rodadas e datas"]
  F --> G
  G --> H{"Simular sorteio?"}
  H -- Sim --> I["Alterar apenas a prévia"]
  H -- Não --> J["Preservar chaveamento sugerido"]
  I --> K["Salvar rascunho PREPARACAO/CRIADA"]
  J --> K
  K --> L["Reabrir e editar quando necessário"]
  L --> M["Ativar temporada"]
  M --> N["Arquivar atual + ativar nova + atualizar temporada_atual"]
```

No PHP, a última transição é atômica e sofre rollback integral em qualquer erro.
No QAS, a mesma regra funcional é protegida por `ScriptLock`.

## Cadastrar ou corrigir temporada histórica

```mermaid
flowchart TD
  A["Selecionar primeiro ano passado disponível"] --> B["Baixar/preencher modelo"]
  B --> C["Importar XLSX"]
  C --> D["Validar A e B opcional"]
  D --> E{"Série B ausente?"}
  E -- Sim --> F["Confirmar que não houve Série B"]
  E -- Não --> G["Validar B com pelo menos 2"]
  F --> H["Revisar editor"]
  G --> H
  H --> I["Salvar rascunho PREPARACAO/LEGADA"]
  I --> J["Publicar como ARQUIVADA"]
  J --> K["Histórico público"]
  K --> L{"Correção posterior?"}
  L -- Sim --> M["Abrir temporada arquivada legada e editar"]
  M --> K
```

## W.O. direto

```mermaid
flowchart TD
  A["Marcar W.O. no participante"] --> B["Encontrar todos os confrontos"]
  B --> C{"Adversário também tem W.O. direto?"}
  C -- Sim --> D["0 x 0; encerrada; observação de ambos"]
  C -- Não --> E["2 x 0 para adversário; encerrada; nome do perdedor"]
  D --> F["Salvar participante e partidas na mesma operação lógica"]
  E --> F
  F --> G["Classificação reordenada"]
  G --> H["Ranking atribui 0 naquele ano"]
```

## Gerar arquivos

```mermaid
flowchart TD
  A["Abrir Planilhas"] --> B["Selecionar temporada, divisão e versão"]
  B --> C["Selecionar grupos/folhas"]
  C --> D{"XLSX selecionado?"}
  D -- Sim --> E["API fornece dataset"]
  E --> F["ExcelJS gera workbook no navegador"]
  C --> G{"Regulamento selecionado?"}
  G -- Sim --> H["API valida taxa e intervalo de datas"]
  H --> I["PHP parametriza modelo DOCX"]
  F --> J["Download XLSX"]
  I --> K["Download DOCX"]
```

## Encerramento e ranking

```mermaid
flowchart TD
  A["Resultados finais conferidos"] --> B["Classificação final calculada"]
  B --> C["Definir referência do ranking"]
  C --> D["Buscar Séries A até a referência"]
  D --> E["Calcular pontos por posição; W.O. direto = 0"]
  E --> F["Somar janela de 5 anos"]
  F --> G["Desempatar pela ordem anterior"]
  G --> H["Limitar aos 30 primeiros"]
  H --> I["Publicar página e folha Ranking"]
```
