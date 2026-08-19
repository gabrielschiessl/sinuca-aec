# Banco MySQL

## Instalação

Crie um banco e um usuário exclusivos para o AEC Sinuca. Não reutilize o banco
ou o usuário do WordPress.

Em um banco novo, importe somente `migrations/001_initial_schema.sql`. Esse
arquivo representa o schema consolidado atual e já contém os campos adicionados
pelas migrações posteriores.

Os arquivos 002 a 004 são incrementais e existem apenas para atualizar bancos
criados por versões antigas. Antes de aplicá-los, consulte a tabela
`schema_migrations` e confirme a estrutura existente.

Depois, copie `api/config.example.php` para `api/config.local.php` no servidor e
preencha as credenciais. Valide a instalação acessando:

`/sinuca-aec/api/?acao=status`

## Atualizações

Antes de aplicar uma nova migração, faça backup integral do banco. Dumps,
snapshots e arquivos de importação devem permanecer fora da pasta pública e não
são versionados pelo projeto.
