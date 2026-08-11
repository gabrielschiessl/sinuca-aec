# Banco MySQL — AEC Sinuca

## Primeira instalação

1. Crie um banco e um usuário exclusivos para o sistema.
2. Importe `migrations/001_initial_schema.sql` pelo phpMyAdmin ou cliente MySQL.
3. Copie `api/config.example.php` para `api/config.local.php` somente no servidor.
4. Preencha as credenciais em `config.local.php`; esse arquivo é ignorado pelo Git.
5. Acesse `/sinuca-aec/api/?acao=status` para validar o PHP e a conexão.

Se o schema `001_initial_schema.sql` já tiver sido importado antes da criação do
agendamento por partida, importe também `migrations/002_match_schedule.sql`.

## Migração das planilhas

1. Adicione `appsscript/migracao_mysql.gs` ao projeto Apps Script atual.
2. Execute `exportarSnapshotMigracaoMySql` manualmente no editor.
3. Baixe do Google Drive o JSON indicado no log da execução.
4. Gere o SQL localmente:

   `node scripts/generate-mysql-import.mjs caminho/snapshot.json database/import_generated.sql`

5. Revise o resumo exibido e importe `database/import_generated.sql` pelo
   phpMyAdmin no banco vazio.

O importador escolhe as tabelas publicadas para temporadas ativas/arquivadas e
as tabelas de preparação para rascunhos. Uma segunda importação no mesmo banco
falha por chaves duplicadas e desfaz a transação, evitando sobreposição silenciosa.

Não use o banco ou o usuário do WordPress. Guarde dumps e backups fora da pasta pública.
