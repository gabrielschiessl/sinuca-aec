# Documentação do AEC Sinuca

Esta pasta é a fonte de contexto funcional e técnico do sistema. O código é a
fonte final de verdade quando houver divergência, mas toda alteração relevante
deve atualizar estes documentos no mesmo commit.

## Ordem recomendada de leitura

1. [Contexto para retomada e IA](CONTEXTO_IA.md)
2. [Visão funcional e regras de negócio](VISAO_FUNCIONAL.md)
3. [Arquitetura](ARQUITETURA.md)
4. [Banco de dados](BANCO_DE_DADOS.md)
5. [Contratos da API](API.md)
6. [Fluxos BPM](FLUXOS_BPM.md)
7. [Importação e documentos gerados](DOCUMENTOS_E_IMPORTACAO.md)
8. [Operação, configuração e publicação](OPERACAO_E_DEPLOY.md)
9. [Testes e manutenção](TESTES_E_MANUTENCAO.md)
10. [Decisões e pendências](DECISOES_E_PENDENCIAS.md)

Referências específicas:

- [Configuração do login Google](CONFIGURACAO_LOGIN_GOOGLE.md)
- [Instalação do banco](../database/README.md)
- [Placar compartilhado por salas — implementação em etapas](PLACAR_COMPARTILHADO.md)

## Regra de manutenção

Ao alterar comportamento, contrato, tabela, configuração, rota, fluxo
administrativo ou arquivo gerado:

1. atualize o documento correspondente;
2. atualize `CONTEXTO_IA.md` se o contexto necessário para retomada mudou;
3. registre decisão ou pendência relevante em `DECISOES_E_PENDENCIAS.md`;
4. valide links e diagramas Mermaid;
5. mencione a documentação atualizada na entrega e no commit.

Mudanças exclusivamente visuais e locais não exigem reescrever todos os
documentos, mas devem ser registradas quando alterarem breakpoints, navegação ou
comportamento de componentes reutilizados.
