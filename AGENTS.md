# Instruções para agentes e IAs

Antes de alterar este repositório:

1. leia `docs/CONTEXTO_IA.md`;
2. consulte `docs/README.md` e os documentos da área afetada;
3. execute `git status --short` e preserve alterações existentes;
4. confirme no código qualquer informação sensível a divergência;
5. preserve a paridade de contrato entre PHP/MySQL e Apps Script, lembrando que
   MySQL usa transações ACID e Sheets usa `ScriptLock`/coordenação multiaba;
6. não exponha `api/config.local.php`, credenciais, tokens, e-mails privados,
   dumps ou dados pessoais;
7. atualize a documentação pertinente no mesmo trabalho;
8. rode as verificações de `docs/TESTES_E_MANUTENCAO.md`.

## Fontes de verdade

- Regras calculadas: `api/src/StatisticsCalculator.php` e validações de
  `api/src/AdminService.php`.
- Contrato de entrada do frontend: `js/api.js`.
- Roteamento PHP: `api/index.php`.
- Schema consolidado: `database/migrations/001_initial_schema.sql`.
- Backend QAS: `appsscript/`.
- Documentação: contexto e intenção; se divergir do código, investigar, corrigir
  a divergência e registrar a decisão.

## Segurança de alterações

- Use transações para operações administrativas compostas.
- Não remova migrations já publicadas.
- Não apague binários ou dados sem confirmar os alvos.
- Preserve os modelos DOCX/XLSX e assets usados nas exportações.
- Teste responsividade e Safari/iPhone em mudanças de interface.
