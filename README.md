# AEC Sinuca

Sistema web do Campeonato de Sinuca do Acesita Esporte Clube.

## Documentação

A documentação funcional, técnica, operacional e o contexto completo para
retomada por outra pessoa ou IA estão em [`docs/README.md`](docs/README.md).
Comece por [`docs/CONTEXTO_IA.md`](docs/CONTEXTO_IA.md).

## Estrutura atual

- `index.html`, `css/`, `js/` e as pastas de rota compõem a SPA pública e administrativa.
- `api/` contém a API PHP 8.3 usada em produção.
- `database/migrations/` contém o schema e as migrações incrementais do MySQL.
- `appsscript/` mantém o backend alternativo de QAS, acessível com `?api=appscript`.
- `assets/templates/modelo-temporada-historica.xlsx` é o modelo de importação.
- `api/templates/regulamento-aec.docx` é o modelo usado para gerar o regulamento parametrizado.

## Configuração da API

1. Importe as migrações SQL na ordem indicada em `database/README.md`.
2. Copie `api/config.example.php` para `api/config.local.php` no servidor.
3. Preencha banco, cliente Google e e-mails administradores.
4. Confirme a conexão em `/sinuca-aec/api/?acao=status`.

O arquivo `api/config.local.php` contém segredos e não deve ser versionado.

No QAS Apps Script, revise `SPREADSHEET_ID` e `GOOGLE_CLIENT_ID`. O DOCX usa
`REGULATION_TEMPLATE_URL`; opcionalmente, informe uma cópia isolada do modelo no
Drive por `REGULATION_TEMPLATE_FILE_ID`.

## Dependências do servidor

- PHP 8.3;
- MySQL/MariaDB com `utf8mb4`;
- extensões PHP `pdo_mysql`, `curl`, `json`, `dom` e `zip`.

## Publicação

Envie o conteúdo do repositório para `/sinuca-aec` no servidor, preservando os
arquivos `.htaccess` e `api/templates/regulamento-aec.docx`. A pasta `.git` e os
diretórios locais `.tmp/`, `tmp/` e `outputs/` não devem ser publicados.
