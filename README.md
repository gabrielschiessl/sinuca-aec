# sinuca-aec
Sistema de campeonato de sinuca com classificação atualizada em tempo real!

## Arquivos gerados e modelos

- `api/templates/regulamento-aec.docx` é o modelo oficial usado em produção e deve ser versionado e enviado ao servidor.
- `.tmp/`, `tmp/` e `outputs/` são áreas locais de auditoria, renderização e testes; são ignoradas pelo Git e podem ser apagadas com segurança.
- A geração do regulamento exige as extensões PHP `zip` e `dom`, além das extensões já utilizadas pela API e pelo MySQL.
