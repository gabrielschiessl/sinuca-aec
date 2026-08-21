# Contexto completo para retomada por pessoa ou IA

> Leia este arquivo primeiro quando a conversa anterior não estiver disponível.
> Depois siga os links do índice em `docs/README.md`. Não presuma que os dois
> backends possuem paridade de contrato, mas garantias de persistência distintas.

## Objetivo

O AEC Sinuca administra os campeonatos anuais de sinuca das Séries A e B do
Acesita Esporte Clube. O sistema publica rodadas, partidas, classificação,
resultados, histórico e ranking; oferece uma área administrativa; importa
temporadas por planilha; e gera documentos XLSX/DOCX para impressão.

## Estado atual resumido

- URL de produção: `https://netzup.com.br/sinuca-aec/`.
- Hospedagem: HostGator/cPanel, dentro de uma instalação cujo domínio principal
  também possui WordPress.
- Frontend: SPA em HTML, CSS e JavaScript ES Modules, sem bundler; instalável
  como PWA sem convite de instalação criado pela interface.
- API principal: PHP 8.3 + MySQL, em `api/`.
- Backend alternativo/QAS: Google Apps Script + Google Sheets, selecionado com
  `?api=appscript` ou `?api=apps-script`.
- Backend padrão: MySQL; `?api=mysql` é desnecessário.
- Autenticação administrativa: Google Identity Services e lista privada de
  e-mails autorizados no servidor.
- Idioma e domínio do negócio: português do Brasil.
- Temporada inicial conhecida pelo frontend: 2026 (`js/config.js`).
- API PHP anuncia versão `2.1.0` no endpoint `status`.

## Arquivos que devem ser preservados no servidor

- `api/config.local.php`: credenciais locais; nunca versionar.
- `api/templates/regulamento-aec.docx`: modelo obrigatório para gerar DOCX.
- `assets/templates/modelo-temporada-historica.xlsx`: modelo de importação.
- `.htaccess`: política de cache/revalidação.

Não publicar `.git`, `.tmp`, `tmp`, `outputs`, dumps ou backups.

## Rotas atuais

- `/`: página inicial.
- `/serie-a`: Série A.
- `/serie-b`: Série B.
- `/regra`: Regra, bolas e regulamento.
- `/historico`: temporadas arquivadas.
- `/ranking`: ranking móvel de cinco temporadas.
- `/administrador`: login e painel administrativo.

Cada pasta de rota contém um `index.html` que redireciona para a SPA mantendo a
URL amigável. O `404.html` reconstrói a rota quando a hospedagem entrega 404.
`manifest.webmanifest` e `service-worker.js` cuidam da instalação PWA e do
fallback conservador do casco estático; a API não é interceptada pelo worker.

## Regras essenciais

- Série A nova: exatamente 20 participantes.
- Série B nova: pelo menos 2; pode ter quantidade par ou ímpar.
- Temporadas históricas: Série A com pelo menos 2; Série B opcional e, quando
  presente, com pelo menos 2.
- Todos contra todos em turno único; quantidade ímpar gera uma folga por rodada.
- Partida regular termina normalmente em 2 x 0 ou 2 x 1.
- W.O. individual encerra em 2 x 0 e grava `W.O.: Nome do perdedor`.
- W.O. duplo encerra em 0 x 0 e grava `W.O.: ambos abandonaram a competição`.
- `direct_wo` no participante faz todos os jogos pertinentes virarem W.O. e
  zera a pontuação daquela participação no ranking.
- Datas aceitam qualquer dia da semana. Na criação de temporada, somente o
  preenchimento automático das rodadas seguintes alterna terça e quinta.
- Critérios de classificação: vitórias; partidas singulares vencidas; W.O.
  direto abaixo de participante equivalente sem W.O.; desempate manual;
  confronto direto; número do participante.
- Zonas: Série A marca líder e quatro últimos; Série B marca até quatro primeiros.

## Ranking

- Considera somente Série A.
- Janela de cinco temporadas terminando no ano de referência.
- Referência automática: temporada atual menos um; administrador pode escolher
  outra referência.
- Pontos por temporada: total de participantes para o 1º, decrescendo até 1.
- Participante marcado como W.O. direto recebe 0 naquele ano.
- Exibe no máximo 30 jogadores.
- Empates usam a ordem do ranking anterior; depois nome e ID.
- Jogadores do ranking anterior podem permanecer com 0 quando faltarem nomes
  suficientes para completar 30 posições.

## Área administrativa

Começa em modo visualização e exige ativação deliberada do modo edição. Abas:

1. Partidas: datas, status, placares, W.O., observações e salvamento em lote.
2. Participantes: jogador por número, desempate manual e W.O. direto.
3. Jogadores: cadastro, nomes, apelidos e ativação.
4. Temporadas: nova, atual e histórica; rascunho, importação, chaveamento,
   publicação e referência do ranking.
5. Planilhas: XLSX manual/atualizada e regulamento DOCX parametrizado.

## Arquivos gerados

XLSX por temporada/divisão, com seleção de folhas:

- jogadores;
- ficha de inscrição;
- classificação simples (somente atualizada);
- classificação (somente atualizada);
- vitórias;
- resultados (somente atualizada);
- partidas vencidas;
- ranking (somente atualizada e Série A);
- rodadas;
- fichas individuais.

O DOCX de regulamento usa ano, taxa de inscrição, menor data e maior data entre
as rodadas das duas divisões da temporada selecionada.

## Dependências externas

- Google Identity Services;
- Google Fonts;
- Bootstrap Icons 1.13.1;
- ExcelJS 4.4.0 carregado sob demanda;
- SheetJS 0.20.3 carregado sob demanda;
- endpoint Google `tokeninfo` para validar credenciais.

## Pontos de atenção antes de alterar

1. Não apagar `appsscript/`: ainda é o QAS alternativo.
2. Preservar a paridade de contrato entre Apps Script e PHP em toda ação nova.
3. Preservar alterações do usuário em uma árvore Git suja.
4. Alterações de banco devem ser transacionais e acompanhadas por migração.
5. Não expor credenciais, e-mails privados, tokens ou dumps.
6. Validar mobile/Safari; inputs abaixo de 16 px provocam zoom automático no iOS.
7. As páginas e planilhas têm regras de impressão e responsividade específicas.
8. Atualizar esta documentação no mesmo trabalho.

## Pendências conhecidas em 19/08/2026

- A paridade de contrato PHP/Apps Script foi concluída, incluindo ativação,
  ranking, configurações, edição vigente, exportação e regulamento. Alterações
  futuras precisam modificar e testar os dois backends no mesmo trabalho.
- O QAS busca o modelo DOCX público de produção por padrão. Para testar uma
  versão isolada, configure `REGULATION_TEMPLATE_FILE_ID` com uma cópia no Drive.
- Os assets binários órfãos identificados durante a limpeza ainda foram
  preservados porque sua exclusão definitiva aguardava confirmação explícita.
- Não há suíte automatizada completa nem CI; as validações são descritas em
  `TESTES_E_MANUTENCAO.md`.

## Como retomar uma alteração

1. Execute `git status --short` e não sobrescreva alterações existentes.
2. Leia este arquivo, o documento do domínio afetado e o código correspondente.
3. Confirme se o recurso deve funcionar em MySQL, Apps Script ou ambos.
4. Faça a menor alteração coerente e preserve contratos públicos.
5. Rode as verificações indicadas em `TESTES_E_MANUTENCAO.md`.
6. Teste em desktop e Safari/iPhone quando houver interface.
7. Atualize a documentação e registre pendências reais.

Os formatos de importação e todas as folhas geradas estão detalhados em
`DOCUMENTOS_E_IMPORTACAO.md`.
