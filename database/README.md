# Banco MySQL

## Instalação

Crie um banco e um usuário exclusivos para o AEC Sinuca. Não reutilize o banco
ou o usuário do WordPress.

Em um banco novo, importe `migrations/001_initial_schema.sql` e depois
`migrations/005_scoreboard_rooms.sql` e `migrations/006_scoreboard_control.sql`.
O arquivo 001 contém os campos das migrações 002–004; 005 acrescenta as salas
e 006 a senha de transferência e os limites de tentativas.

Os arquivos 002 a 004 são incrementais e existem apenas para atualizar bancos
criados por versões antigas. Antes de aplicá-los, consulte a tabela
`schema_migrations` e confirme a estrutura existente.

Depois, copie `api/config.example.php` para `api/config.local.php` no servidor e
preencha as credenciais. Valide a instalação acessando:

`/sinuca-aec/api/?acao=status`

## Atualizações

Para um banco com 005 já instalada, aplique somente `006_scoreboard_control.sql`.
Se ainda não houver salas, aplique 005 e 006. Selecione primeiro o banco do AEC
Sinuca no phpMyAdmin. Esta etapa não habilita salas na interface nem altera os
dados dos campeonatos.
Veja [o plano e a validação das salas](../docs/PLACAR_COMPARTILHADO.md).

Antes de aplicar uma nova migração, faça backup integral do banco. Dumps,
snapshots e arquivos de importação devem permanecer fora da pasta pública e não
são versionados pelo projeto.
